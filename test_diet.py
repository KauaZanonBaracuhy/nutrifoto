"""Compatibilidade: executa apenas a suíte isolada atual, sem APIs pagas."""
from pathlib import Path
import subprocess
import sys
raiz = Path(__file__).resolve().parent
resultado = subprocess.run(["node", "testes/interface.cjs"], cwd=raiz)
sys.exit(resultado.returncode)
