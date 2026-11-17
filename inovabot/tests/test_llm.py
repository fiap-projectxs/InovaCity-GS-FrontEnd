import sys, pathlib, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))
from llm import limpar


class T(unittest.TestCase):
    def test_remove_raciocinio_qwen(self):
        self.assertEqual(limpar("<think>\nvou pensar\n</think>\n\nResposta final."), "Resposta final.")

    def test_sem_marcas(self):
        self.assertEqual(limpar("  oi  "), "oi")


if __name__ == "__main__":
    unittest.main()
