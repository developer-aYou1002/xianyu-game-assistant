"""仅供本机插件调用的只读游戏查询服务。"""

import argparse
import hmac
import json
import secrets
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def lookup(path, name):
    """只查询名称列，防止网盘链接进入响应；精确匹配优先于包含匹配。"""
    with sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True) as db:
        rows = db.execute(
            'SELECT DISTINCT name FROM games WHERE name = ? COLLATE NOCASE LIMIT 6',
            (name,),
        ).fetchall()
        if not rows:
            rows = db.execute(
                'SELECT DISTINCT name FROM games WHERE instr(lower(name), lower(?)) > 0 '
                'ORDER BY name LIMIT 6', (name,),
            ).fetchall()
    names = [row[0] for row in rows]
    status = 'missing' if not names else 'found' if len(names) == 1 else 'multiple'
    return {'status': status, 'names': names[:5], 'more': len(names) > 5}


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        # 使用随机密钥限制本机接口访问，不向任意网页开放跨域权限。
        supplied = self.headers.get('Authorization', '')
        if not hmac.compare_digest(supplied, 'Bearer ' + self.server.token):
            self.respond(401, {'error': '访问密钥不正确'})
            return
        if self.path != '/lookup':
            self.respond(404, {'error': '接口不存在'})
            return
        try:
            self.handle_lookup()
        except (ValueError, UnicodeError, TypeError):
            self.respond(400, {'error': '请求格式不正确'})
        except sqlite3.Error:
            self.respond(503, {'error': '数据库暂不可用，请检查路径和 games.name 字段'})

    def handle_lookup(self):
        size = int(self.headers.get('Content-Length', '0'))
        if not 0 < size <= 4096:
            raise ValueError('请求大小超限')
        data = json.loads(self.rfile.read(size))
        name = data.get('name') if isinstance(data, dict) else None
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
            raise ValueError('游戏名称无效')
        self.respond(200, lookup(self.server.db_path, name.strip()))

    def log_message(self, format_string, *args):
        # 不记录客户查询内容或认证密钥。
        pass


def main():
    parser = argparse.ArgumentParser(description='闲鱼游戏查询本地服务')
    default_db = Path(__file__).resolve().parents[2] / 'scrapers/xdgame/data/xdgame.db'
    parser.add_argument('--db', default=default_db, type=Path, help='现有 SQLite 文件路径，默认使用相邻爬虫项目的正式库')
    parser.add_argument('--port', type=int, default=18765)
    args = parser.parse_args()
    if not args.db.is_file():
        parser.error('数据库文件不存在，不会自动创建空数据库')
    lookup(args.db, '__启动检查__')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.db_path = args.db
    server.token = secrets.token_urlsafe(32)
    print(f'本地服务：http://127.0.0.1:{args.port}', flush=True)
    print(f'本次访问密钥：{server.token}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
