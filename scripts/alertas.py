"""Alertas do robô: abre um aviso (issue) no GitHub quando

1. um número manual de dados/referencias.json passou da validade (ex.: Miami, Punta del Este, DWV);
2. aparece notícia nova sobre Porto Belo + DWV / m² (para conferir e atualizar a série do site).

Nada é publicado no site por aqui: o robô só avisa. A conferência é humana.
Roda no GitHub Actions depois de atualizar.py. Sem GITHUB_TOKEN (uso local), só imprime os alertas.
"""
import datetime as dt
import email.utils
import json
import os
import sys
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARQ_REFS = RAIZ / "dados" / "referencias.json"
ARQ_VISTAS = RAIZ / "dados" / "noticias_vistas.json"
UA = {"User-Agent": "Mozilla/5.0 (atualizador-calculadora)"}
HOJE = dt.date.today()
DONO = "santiagofcosta-spec"
SITE = "https://santiagofcosta-spec.github.io/investir-costa-esmeralda/"
BUSCAS = ['"Porto Belo" DWV', '"Porto Belo" "metro quadrado"', '"Porto Belo" imóveis "m²"']
JANELA_DIAS = 45  # só notícias recentes
PALAVRAS = ("dwv", "m²", "m2", "metro quadrado", "valoriz", "preco", "vgv", "vendas", "bilh", "milh")  # manchete precisa falar de preço/mercado


def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def fmt(iso):
    y, m, d = iso.split("-")
    return f"{d}/{m}/{y}"


# ---------------------------------------------------------------- validade dos dados manuais
def itens_com_validade(refs):
    for chave, item in refs.items():
        if isinstance(item, dict) and "atualizado" in item:
            yield chave, item
        if isinstance(item, dict):
            for sub, s in item.items():
                if isinstance(s, dict) and "atualizado" in s:
                    yield f"{chave}.{sub}", s


def vencidos(refs):
    alertas = []
    for chave, it in itens_com_validade(refs):
        idade = (HOJE - dt.date.fromisoformat(it["atualizado"])).days
        if idade <= it["validadeDias"]:
            continue
        nome = it.get("nome", chave)
        if it.get("auto"):
            acao = ("Este dado é atualizado sozinho pelo robô, então a fonte provavelmente parou de responder "
                    "ou mudou de formato. Veja a aba **Actions** do repositório (passo `atualizar.py`) para o erro.")
        else:
            acao = ("Este número é conferido à mão. Abra o Claude Code na pasta `teste-claude`, digite "
                    "`/retomar-costa-esmeralda` e peça: *atualizar " + nome + "*. Depois de conferido, "
                    "a data em `dados/referencias.json` é renovada e este aviso pode ser fechado.")
        alertas.append({
            "titulo": f"Dado vencido: {nome}",
            "corpo": (f"@{DONO}\n\n**{nome}** foi conferido pela última vez em **{fmt(it['atualizado'])}** "
                      f"({idade} dias atrás). O prazo combinado é de {it['validadeDias']} dias.\n\n"
                      f"Enquanto não for atualizado, o site mostra ao lado do número: *dado de ..., pode estar desatualizado*.\n\n"
                      f"**O que fazer:** {acao}\n\nChave no arquivo: `{chave}` · Site: {SITE}"),
        })
    return alertas


# ---------------------------------------------------------------- notícias novas (Porto Belo / DWV)
def buscar_noticias():
    achadas = {}
    for q in BUSCAS:
        url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q, "hl": "pt-BR", "gl": "BR", "ceid": "BR:pt-419"})
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
            raiz = ET.fromstring(r.read())
        for it in raiz.iter("item"):
            titulo, link = (it.findtext("title") or "").strip(), (it.findtext("link") or "").strip()
            try:
                quando = email.utils.parsedate_to_datetime(it.findtext("pubDate")).date()
            except Exception:
                continue
            t = sem_acento(titulo)
            if "porto belo" not in t or not any(p in t for p in PALAVRAS) or (HOJE - quando).days > JANELA_DIAS:
                continue
            achadas[link] = {"titulo": titulo, "link": link, "data": quando.isoformat()}
    return list(achadas.values())


def noticias_novas():
    vistas = json.loads(ARQ_VISTAS.read_text(encoding="utf-8")) if ARQ_VISTAS.exists() else []
    novas = [n for n in buscar_noticias() if n["link"] not in vistas]
    if novas:
        vistas = (vistas + [n["link"] for n in novas])[-500:]
        ARQ_VISTAS.write_text(json.dumps(vistas, ensure_ascii=False, indent=0), encoding="utf-8")
    if not novas:
        return []
    novas.sort(key=lambda n: n["data"], reverse=True)
    lista = "\n".join(f"- {fmt(n['data'])} · [{n['titulo']}]({n['link']})" for n in novas)
    return [{
        "titulo": f"Notícias novas sobre Porto Belo ({HOJE.strftime('%d/%m/%Y')})",
        "corpo": (f"@{DONO}\n\nO robô encontrou notícias recentes sobre o mercado de Porto Belo. "
                  f"Se alguma trouxer **m² médio, valorização ou vendas da DWV**, vale atualizar o site "
                  f"(série histórica de Porto Belo, m² atual e vendas).\n\n{lista}\n\n"
                  f"**O que fazer:** abra o Claude Code na pasta `teste-claude`, digite `/retomar-costa-esmeralda` "
                  f"e cole o link da notícia. O número é conferido antes de entrar no site (nada é publicado sozinho). "
                  f"Se nenhuma notícia trouxer número novo, basta fechar este aviso."),
    }]


# ---------------------------------------------------------------- GitHub issues
def gh(metodo, caminho, corpo=None):
    req = urllib.request.Request(
        f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}{caminho}",
        data=json.dumps(corpo).encode() if corpo is not None else None, method=metodo,
        headers={"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}", "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28", **UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read() or b"null")


def publicar(alertas):
    if not alertas:
        print("Nenhum alerta.")
        return
    if not os.environ.get("GITHUB_TOKEN"):
        for a in alertas:
            print(f"[simulação] {a['titulo']}\n{a['corpo']}\n")
        return
    abertos = {i["title"] for i in gh("GET", "/issues?state=open&per_page=100") if "pull_request" not in i}
    for a in alertas:
        if a["titulo"] in abertos:
            print(f"Já aberto: {a['titulo']}")
            continue
        n = gh("POST", "/issues", {"title": a["titulo"], "body": a["corpo"]})
        print(f"Aviso aberto: #{n['number']} {a['titulo']}")


def main():
    alertas = []
    alertas += vencidos(json.loads(ARQ_REFS.read_text(encoding="utf-8")))
    try:
        alertas += noticias_novas()
    except Exception as e:  # busca de notícias fora do ar não impede os outros avisos
        print(f"Notícias: ERRO {type(e).__name__}: {e}")
    publicar(alertas)
    return 0


if __name__ == "__main__":
    sys.exit(main())
