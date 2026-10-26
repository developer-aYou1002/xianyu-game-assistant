"""使用临时资源库验证匹配边界和链接不外泄。"""

import sqlite3
import tempfile
import unittest
from pathlib import Path
from service.server import lookup


class LookupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'games.db'
        with sqlite3.connect(self.path) as db:
            db.execute('CREATE TABLE games (name TEXT, quark_url TEXT)')
            db.executemany('INSERT INTO games VALUES (?, ?)', [
                ('游戏甲', 'https://secret.example/1'),
                ('游戏甲 豪华版', 'https://secret.example/2'),
                ('Portal', 'https://secret.example/3'),
            ])

    def test_exact_precedes_partial(self):
        self.assertEqual(lookup(self.path, '游戏甲')['names'], ['游戏甲'])

    def test_multiple_and_missing(self):
        self.assertEqual(lookup(self.path, '游戏')['status'], 'multiple')
        self.assertEqual(lookup(self.path, '不存在')['status'], 'missing')

    def test_literal_input_and_case(self):
        self.assertEqual(lookup(self.path, '%')['status'], 'missing')
        self.assertEqual(lookup(self.path, "' OR 1=1 --")['status'], 'missing')
        self.assertEqual(lookup(self.path, 'portal')['status'], 'found')

    def test_no_links(self):
        self.assertNotIn('secret', str(lookup(self.path, '游戏')))


if __name__ == '__main__':
    unittest.main()
