"""Login por corretor na Área restrita: cria, troca e remove o acesso de cada corretor da Goya.

Uso: dois cliques em costa-esmeralda-docs\\privado\\CADASTRAR-CORRETORES.bat

- A lista de corretores (nome, CRECI, WhatsApp) fica em privado\\corretores.json.
- Para os corretores, a senha é CRIADA aqui (forte e aleatória) e aparece só nesta janela e numa página
  temporária com um botão de WhatsApp por corretor (para o Santiago repassar). A página é apagada no fim.
- A senha do Santiago é DIGITADA por ele aqui (opção 4).
- Nenhuma senha é salva: o que fica guardado é a chave das tabelas cifrada com cada senha (privado\\acessos.json).
- Depois de qualquer mudança, as tabelas são cifradas de novo e publicadas.
"""
import getpass
import html
import json
import os
import re
import secrets
import sys
import unicodedata
import urllib.parse
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cifrar_tabelas as ct   # noqa: E402

CORRETORES = ct.PRIV / "corretores.json"
PAGINA = ct.PRIV / "ENVIAR-SENHAS.html"
SITE = "https://santiagofcosta-spec.github.io/investir-costa-esmeralda/?modo=corretor&aba=corretor"


def slug(nome):
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def nova_senha():
    """12 números em 3 blocos (ex.: 4827 1930 5562), pedido do Santiago: fácil no teclado do celular.
    Menos que isso não serve: o arquivo cifrado é público e pode ser testado sem limite fora do site
    (6 números caem em minutos; 12 levam anos com 600.000 iterações de PBKDF2)."""
    return " ".join("".join(secrets.choice("0123456789") for _ in range(4)) for _ in range(3))


def so_digitos(t):
    return re.sub(r"\D", "", t or "")


def lista():
    d = json.loads(CORRETORES.read_text(encoding="utf-8"))
    for c in d["corretores"]:
        c["id"] = slug(c["nome"])
    return d["corretores"]


def entrada(c, senha, chave):
    w = so_digitos(c.get("whatsapp"))
    if not c.get("email"):
        raise SystemExit(f"{c['nome']} está sem e-mail em corretores.json (o e-mail é o login).")
    u = {"id": c["id"], "login": ct.hash_email(c["email"]), "nome": c["nome"], "creci": c.get("creci", ""), "whatsapp": ("55" + w) if w else "",
         "whatsappTxt": c.get("whatsapp", "")}
    u.update(ct.embrulhar(chave, c["id"], senha))
    return u


def pagina(novas):
    """página temporária com a senha e um botão de WhatsApp por corretor."""
    linhas = []
    for c, s in novas:
        primeiro = c["nome"].split()[0]
        msg = (f"Olá, {primeiro}! Seu acesso à Área restrita do site Investir na Costa Esmeralda (Goya):\n"
               f"{SITE}\n\nE-mail: {c['email']}\nSenha: {s}\n\n"
               "No site, digite o seu e-mail e a senha (pode digitar com ou sem os espaços). As propostas em PDF saem com o seu nome"
               f"{', CRECI' if c.get('creci') else ''} e WhatsApp. Não compartilhe a senha.")
        w = so_digitos(c.get("whatsapp"))
        bt = (f'<a class="bt" href="https://wa.me/55{w}?text={urllib.parse.quote(msg)}" target="_blank">Enviar pelo WhatsApp</a>'
              if w else '<span class="sem">sem WhatsApp</span>')
        linhas.append(f"<tr><td><b>{html.escape(c['nome'])}</b><br><small>{html.escape(c['email'])} · {html.escape(c.get('whatsapp', ''))}</small></td>"
                      f"<td><code>{html.escape(s)}</code></td><td>{bt}</td></tr>")
    PAGINA.write_text(f"""<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Senhas novas</title>
<style>body{{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#14201d}}table{{border-collapse:collapse}}
td{{padding:10px 14px;border-bottom:1px solid #ddd}}code{{font-size:18px;background:#f2f2f2;padding:4px 8px;border-radius:6px}}
.bt{{background:#1f8f4e;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none}}.av{{background:#fff4d6;padding:10px 14px;border-radius:8px}}</style>
<h1>Senhas novas da Área restrita</h1>
<p class="av">Clique em <b>Enviar pelo WhatsApp</b> para cada corretor (a mensagem já vai pronta, é só apertar enviar).
Depois volte à janela preta e aperte <b>Enter</b>: esta página é apagada do computador.</p>
<table>{''.join(linhas)}</table></html>""", encoding="utf-8")
    webbrowser.open(PAGINA.as_uri())


def salvar_e_publicar(a, msg):
    ct.gravar_acessos(a)
    print()
    ct.gerar_v2(msg=msg)


def criar(cs, a, chave, alvo):
    novas = []
    for c in alvo:
        s = nova_senha()
        a["usuarios"] = [u for u in a["usuarios"] if u["id"] != c["id"]] + [entrada(c, s, chave)]
        novas.append((c, s))
        print(f"  {c['nome']:<28} senha: {s}")
    return novas


def escolher(cs, texto):
    for i, c in enumerate(cs, 1):
        print(f"  {i:>2}. {c['nome']}")
    n = input(f"\n{texto} (número, ou Enter para voltar): ").strip()
    return cs[int(n) - 1] if n.isdigit() and 1 <= int(n) <= len(cs) else None


def main():
    print("=== Área do corretor: acesso dos corretores ===\n")
    if not ct.CHAVE.exists():
        ct.CHAVE.write_bytes(os.urandom(32))
        print("Chave nova das tabelas criada (fica só neste computador).\n")
    chave = ct.CHAVE.read_bytes()
    cs = lista()
    eu = next((c for c in cs if c.get("eu")), None)
    a = ct.ler_acessos()
    validos = {c["id"] for c in cs}
    com = {u["id"] for u in a["usuarios"]}
    print("Com acesso: " + (", ".join(u["nome"] for u in a["usuarios"]) or "ninguém ainda"))
    print("""
1. Criar senha para quem ainda não tem acesso
2. Trocar a senha de um corretor
3. Remover o acesso de um corretor
4. Definir a MINHA senha (Santiago, digitada aqui)
0. Sair""")
    op = input("\nEscolha: ").strip()
    novas = []
    if op == "1":
        alvo = [c for c in cs if c["id"] not in com and c is not eu]
        if not alvo:
            print("Todos os corretores já têm acesso.")
            return 0
        print(f"\nCriando {len(alvo)} senha(s)... (alguns segundos)\n")
        novas = criar(cs, a, chave, alvo)
        salvar_e_publicar(a, f"Área restrita: acesso criado para {len(alvo)} corretor(es)")
    elif op == "2":
        c = escolher([c for c in cs if c is not eu], "Trocar a senha de quem")
        if not c:
            return 0
        novas = criar(cs, a, chave, [c])
        salvar_e_publicar(a, "Área restrita: senha trocada")
    elif op == "3":
        quem = [u for u in a["usuarios"]]
        for i, u in enumerate(quem, 1):
            print(f"  {i:>2}. {u['nome']}")
        n = input("\nRemover o acesso de quem (número, ou Enter para voltar): ").strip()
        if not (n.isdigit() and 1 <= int(n) <= len(quem)):
            return 0
        u = quem[int(n) - 1]
        a["usuarios"] = [x for x in a["usuarios"] if x["id"] != u["id"]]
        print(f"\nAcesso de {u['nome']} removido: a senha dele para de funcionar quando o site atualizar.")
        salvar_e_publicar(a, "Área restrita: acesso removido")
    elif op == "4":
        if not eu:
            print("Marque o seu nome com \"eu\": true em corretores.json.")
            return 1
        s = getpass.getpass("Digite a SUA senha (não aparece na tela; mínimo 12 números ou caracteres): ")
        if len(ct.norm_senha(s)) < 12:
            print("Use pelo menos 12 números ou caracteres (ex.: 4827 1930 5562 ou ondas-verdes-porto-belo-2026).")
            return 1
        if getpass.getpass("Digite de novo: ") != s:
            print("As senhas não conferem. Nada foi alterado.")
            return 1
        a["usuarios"] = [u for u in a["usuarios"] if u["id"] != eu["id"]] + [entrada(eu, s, chave)]
        salvar_e_publicar(a, "Área restrita: acesso do Santiago")
    else:
        return 0
    sobra = [u["nome"] for u in a["usuarios"] if u["id"] not in validos]
    if sobra:
        print("\nAtenção: com acesso, mas fora da lista de corretores: " + ", ".join(sobra))
    if novas:
        pagina(novas)
        input("\nAbri uma página com as senhas e os botões de WhatsApp.\n"
              "Depois de enviar para todos, aperte Enter aqui para APAGAR a página do computador. ")
        PAGINA.unlink(missing_ok=True)
        print("Página apagada. As senhas não ficam salvas em lugar nenhum.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
