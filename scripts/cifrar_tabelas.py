"""Cifra as tabelas de empreendimentos (arquivo privado) e publica só a versão embaralhada no site.

Uso: dois cliques em costa-esmeralda-docs\\privado\\ATUALIZAR-TABELAS.bat

Formato 2 (login por corretor, 18/11/2026):
  - as tabelas são cifradas com uma CHAVE aleatória (AES-256-GCM), guardada só neste computador
    em costa-esmeralda-docs\\privado\\chave-tabelas.bin (nunca vai para o GitHub);
  - para cada corretor, essa chave é guardada cifrada com a senha dele (PBKDF2-SHA256, 600.000 iterações),
    em privado\\acessos.json e no arquivo publicado. Login no site = escolher o nome + digitar a senha.
  - as senhas são criadas/trocadas/removidas em CADASTRAR-CORRETORES.bat (scripts/cadastrar_corretores.py)
    e NUNCA ficam salvas. Atualizar as tabelas não pede senha nenhuma: usa a chave guardada.
Formato 1 (antigo, senha única): só se ainda não houver chave-tabelas.bin.
Compatível com a Web Crypto API do navegador (app.js, Área do corretor).
"""
import base64
import hashlib
import re
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
PRIV = RAIZ.parent / "costa-esmeralda-docs" / "privado"
PRIVADO = PRIV / "tabelas.json"
CHAVE = PRIV / "chave-tabelas.bin"
ACESSOS = PRIV / "acessos.json"
SAIDA = RAIZ / "dados" / "tabelas.enc.json"
ITER = 600_000
b64 = lambda b: base64.b64encode(b).decode("ascii")


def derivar(senha: str, sal: bytes) -> bytes:
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=sal, iterations=ITER).derive(senha.encode("utf-8"))


def cifrar(dados: bytes, senha: str) -> dict:
    """formato 1 (senha única) — mantido para quem ainda não cadastrou corretores."""
    sal, iv = os.urandom(16), os.urandom(12)
    ct = AESGCM(derivar(senha, sal)).encrypt(iv, dados, None)
    return {"v": 1, "kdf": "PBKDF2-SHA256", "iter": ITER, "salt": b64(sal), "iv": b64(iv), "ct": b64(ct)}


def norm_senha(s: str) -> str:
    """senha só de números pode ter espaços/traços (ex.: 4827 1930 5562): vale só os dígitos (igual ao site)."""
    return re.sub(r"\D", "", s) if re.fullmatch(r"[\d\s.-]+", s) else s


def hash_email(m: str) -> str:
    """o login é o e-mail; no arquivo publicado vai só o SHA-256 dele (minúsculo, sem espaços)."""
    return hashlib.sha256(m.strip().lower().encode("utf-8")).hexdigest()


def embrulhar(chave: bytes, uid: str, senha: str) -> dict:
    """guarda a chave das tabelas cifrada com a senha de um corretor (o id entra como dado autenticado)."""
    senha = norm_senha(senha)
    sal, iv = os.urandom(16), os.urandom(12)
    ck = AESGCM(derivar(senha, sal)).encrypt(iv, chave, uid.encode("utf-8"))
    return {"iter": ITER, "salt": b64(sal), "iv": b64(iv), "ck": b64(ck)}


def ler_acessos() -> dict:
    return json.loads(ACESSOS.read_text(encoding="utf-8")) if ACESSOS.exists() else {"usuarios": []}


def gravar_acessos(a: dict):
    a["_leia"] = ("PRIVADO: acesso de cada corretor = a chave das tabelas cifrada com a senha dele. "
                  "Não contém senhas. Edite pelo CADASTRAR-CORRETORES.bat.")
    ACESSOS.write_text(json.dumps(a, ensure_ascii=False, indent=1), encoding="utf-8")


def cifrar_v2(dados: bytes, chave: bytes, acessos: dict) -> dict:
    iv = os.urandom(12)
    ct = AESGCM(chave).encrypt(iv, dados, b"tabelas-v2")
    publico = ("id", "login", "nome", "creci", "whatsapp", "whatsappTxt", "iter", "salt", "iv", "ck")
    us = sorted(acessos["usuarios"], key=lambda u: u["nome"].lower())
    return {"v": 2, "kdf": "PBKDF2-SHA256", "iv": b64(iv), "ct": b64(ct),
            "usuarios": [{k: u[k] for k in publico if k in u} for u in us]}


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


def publicar(msg="Atualiza tabelas cifradas da Área do corretor"):
    os.chdir(RAIZ)
    subprocess.run(["git", "add", str(SAIDA.relative_to(RAIZ))], check=True)
    if subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode == 0:
        print("Nada mudou nas tabelas.")
        return
    subprocess.run(["git", "commit", "-q", "-m", msg], check=True)
    subprocess.run(["git", "pull", "-q", "--rebase", "origin", "main"], capture_output=True)   # o robô da soja publica no meio do dia
    r = subprocess.run(["git", "push", "-q", "origin", "main"], capture_output=True, text=True)
    if r.returncode != 0:
        print("Não consegui enviar ao GitHub. Peça ao Claude: 'publica as tabelas cifradas'.")
    else:
        print("Publicado. O site atualiza em 1 a 2 minutos.")


def gerar_v2(publica=True, msg=None):
    """cifra as tabelas com a chave guardada e os acessos atuais (sem pedir senha)."""
    d = json.loads(PRIVADO.read_text(encoding="utf-8"))
    nu, ne = validar(d)
    a = ler_acessos()
    if not a["usuarios"]:
        print("Nenhum corretor com acesso. Rode o CADASTRAR-CORRETORES.bat primeiro.")
        return False
    dados = json.dumps(d, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    SAIDA.write_text(json.dumps(cifrar_v2(dados, CHAVE.read_bytes(), a)), encoding="utf-8")
    print(f"Tabelas cifradas: {ne} empreendimento(s), {nu} unidade(s), {len(a['usuarios'])} pessoa(s) com acesso.")
    if publica and "--sem-publicar" not in sys.argv:
        publicar(msg or "Atualiza tabelas cifradas da Área do corretor")
    return True


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
    if CHAVE.exists():   # formato 2: login por corretor, não precisa de senha aqui
        return 0 if gerar_v2() else 1
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
