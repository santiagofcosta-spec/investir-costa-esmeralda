"""Cifra as tabelas de empreendimentos (arquivo privado) e publica só a versão embaralhada no site.

Uso: dois cliques em costa-esmeralda-docs\\privado\\ATUALIZAR-TABELAS.bat
A senha é digitada aqui e NUNCA é salva. Sem a senha, ninguém lê as tabelas no site.

Criptografia: AES-256-GCM, chave derivada da senha com PBKDF2-SHA256 (600.000 iterações),
compatível com a Web Crypto API usada no navegador (app.js, Área do corretor).
"""
import base64
import getpass
import json
import os
import subprocess
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

RAIZ = Path(__file__).resolve().parent.parent
PRIVADO = RAIZ.parent / "costa-esmeralda-docs" / "privado" / "tabelas.json"
SAIDA = RAIZ / "dados" / "tabelas.enc.json"
ITER = 600_000


def cifrar(dados: bytes, senha: str) -> dict:
    sal, iv = os.urandom(16), os.urandom(12)
    chave = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=sal, iterations=ITER).derive(senha.encode("utf-8"))
    ct = AESGCM(chave).encrypt(iv, dados, None)
    b64 = lambda b: base64.b64encode(b).decode("ascii")
    return {"v": 1, "kdf": "PBKDF2-SHA256", "iter": ITER, "salt": b64(sal), "iv": b64(iv), "ct": b64(ct)}


def validar(d):
    emps = d.get("empreendimentos")
    if not isinstance(emps, list) or not emps:
        raise ValueError("o arquivo precisa ter a lista 'empreendimentos' com pelo menos um item")
    for e in emps:
        for campo in ("id", "nome", "unidades"):
            if campo not in e:
                raise ValueError(f"empreendimento sem o campo '{campo}': {e.get('nome', e)}")
        for u in e["unidades"]:
            if not isinstance(u.get("valor"), (int, float)) or u["valor"] <= 0:
                raise ValueError(f"{e['nome']}: unidade {u.get('unidade')} sem 'valor' numérico (use 1250000, sem pontos)")
    return sum(len(e["unidades"]) for e in emps), len(emps)


def publicar():
    os.chdir(RAIZ)
    subprocess.run(["git", "add", str(SAIDA.relative_to(RAIZ))], check=True)
    if subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode == 0:
        print("Nada mudou nas tabelas.")
        return
    subprocess.run(["git", "commit", "-q", "-m", "Atualiza tabelas cifradas da Área do corretor"], check=True)
    token = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True).stdout.strip()
    url = f"https://x-access-token:{token}@github.com/santiagofcosta-spec/investir-costa-esmeralda.git" if token else "origin"
    r = subprocess.run(["git", "push", "-q", url, "main"], capture_output=True, text=True)
    if r.returncode != 0:
        print("Não consegui enviar ao GitHub. Peça ao Claude: 'publica as tabelas cifradas'.")
    else:
        print("Publicado. O site atualiza em 1 a 2 minutos.")


def main():
    print("=== Área do corretor: atualizar tabelas ===\n")
    if not PRIVADO.exists():
        print(f"Arquivo não encontrado: {PRIVADO}")
        return 1
    try:
        d = json.loads(PRIVADO.read_text(encoding="utf-8"))
        nu, ne = validar(d)
    except Exception as e:
        print(f"Problema no arquivo de tabelas: {e}")
        return 1
    print(f"{ne} empreendimento(s), {nu} unidade(s) encontradas.\n")
    senha = getpass.getpass("Digite a senha da Área do corretor (não aparece na tela): ")
    if len(senha) < 12:
        print("Use uma senha com pelo menos 12 caracteres (ex.: uma frase como ondas-verdes-porto-belo-2026).")
        return 1
    if getpass.getpass("Digite a senha de novo: ") != senha:
        print("As senhas não conferem. Nada foi alterado.")
        return 1
    dados = json.dumps(d, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    SAIDA.write_text(json.dumps(cifrar(dados, senha)), encoding="utf-8")
    print("Tabelas cifradas.")
    if "--sem-publicar" not in sys.argv:
        publicar()
    return 0


if __name__ == "__main__":
    sys.exit(main())
