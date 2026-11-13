"""Atualiza dados/dados.json e dados/dados.js com Banco Central, FipeZap e CUB/SC.

Roda sozinho pelo GitHub Actions (.github/workflows/atualizar.yml).
Cada fonte é independente: se uma falhar, as outras seguem e o dado antigo é mantido.
Uso local:  python scripts/atualizar.py
"""
import datetime as dt
import io
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARQ_JSON = RAIZ / "dados" / "dados.json"
ARQ_JS = RAIZ / "dados" / "dados.js"
UA = {"User-Agent": "Mozilla/5.0 (atualizador-calculadora)"}
HOJE = dt.date.today()
log = []


def baixar(url, timeout=60, tentativas=3):
    """Baixa sem cache. Repete em 304 (cache de proxy) e erros 5xx/rede."""
    import time
    import urllib.error
    cab = {**UA, "Cache-Control": "no-cache", "Pragma": "no-cache"}
    for i in range(tentativas):
        sep = "&" if "?" in url else "?"
        req = urllib.request.Request(f"{url}{sep}_={int(time.time() * 1000)}" if "bcb.gov.br" in url else url, headers=cab)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (304, 429, 500, 502, 503, 504) or i == tentativas - 1:
                raise
        except urllib.error.URLError:
            if i == tentativas - 1:
                raise
        time.sleep(3 * (i + 1))


def num_br(s):
    return float(s.replace(".", "").replace(",", ".").replace("%", "").replace("+", ""))


def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


# ---------------------------------------------------------------- Banco Central
def atualizar_bcb(d):
    series = {"selic": 4189, "cdi": 4391, "ipca": 433, "igpm": 189, "incc": 192, "ivgr": 21340, "usd": 3698}
    inicio = "2016-01"
    brutos = {}
    for nome, cod in series.items():
        url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados?formato=json&dataInicial=01/01/2016"
        brutos[nome] = {}
        for r in json.loads(baixar(url)):
            dd, mm, aa = r["data"].split("/")
            brutos[nome][f"{aa}-{mm}"] = float(r["valor"])
    # mês corrente ainda incompleto no CDI/Selic: descarta
    atual = f"{HOJE.year}-{HOJE.month:02d}"
    for k in ("cdi", "selic"):
        brutos[k].pop(atual, None)
    fim = max(max(v) for v in brutos.values())
    meses, (a, m) = [], (2016, 1)
    while f"{a}-{m:02d}" <= fim:
        meses.append(f"{a}-{m:02d}")
        m += 1
        if m > 12:
            a, m = a + 1, 1
    def ultimo(cod):
        # "ultimos/1" às vezes volta 304 vazio no BCB; pega 5 e escolhe a data mais recente
        rs = json.loads(baixar(f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados/ultimos/5?formato=json"))
        return float(max(rs, key=lambda r: r["data"][6:] + r["data"][3:5] + r["data"][:2])["valor"])
    poup = [float(r["valor"]) for r in json.loads(baixar("https://api.bcb.gov.br/dados/serie/bcdata.sgs.195/dados/ultimos/20?formato=json"))]
    d["bcb"] = {
        "start": inicio,
        "series": {k: [v.get(mm) for mm in meses] for k, v in brutos.items()},
        "poup_m": sum(poup) / len(poup),
        "selicMeta": ultimo(432),
        "cdiAA": ultimo(4389),
    }
    log.append(f"Banco Central: ok até {fim}, Selic {d['bcb']['selicMeta']}%")


# ---------------------------------------------------------------- FipeZap
CIDADES = {"itapema": "Itapema SC", "bc": "Balneário Camboriú SC", "floripa": "Florianópolis SC"}
PCT = r"([+-]?\s?\d+,\d+%|0,00%)"


def ler_fipezap(texto):
    """Linhas: 'Itapema SC -0,71% -0,41% +2,50% +3,48% 15.232' = mês, mês anterior, no ano, 12 meses, R$/m²."""
    out = {}
    linhas = texto.splitlines()
    alvos = dict(CIDADES)
    for chave, rotulo in alvos.items():
        rx = re.compile(r"^" + re.escape(rotulo) + r"\s+" + r"\s+".join([PCT] * 4) + r"\s+(\d{1,2}\.\d{3})\s*$")
        for ln in linhas:
            m = rx.match(ln.strip())
            if m:
                g = [x.replace(" ", "") for x in m.groups()]
                out[chave] = [int(g[4].replace(".", "")), num_br(g[2]), num_br(g[3])]
                break
    rx = re.compile(r"^Índice FipeZAP\+?\s+" + r"\s+".join([PCT] * 4) + r"\s+(\d{1,2}\.\d{3})\s*$")
    for ln in linhas:
        m = rx.match(ln.strip())
        if m:
            g = [x.replace(" ", "") for x in m.groups()]
            out["brasil"] = [int(g[4].replace(".", "")), num_br(g[2]), num_br(g[3])]
            break
    return out


def atualizar_fipezap(d):
    from pypdf import PdfReader
    fz = d["fipezap"]
    ref = HOJE.replace(day=1)
    for _ in range(4):
        ref = (ref - dt.timedelta(days=1)).replace(day=1) if _ else ref
        chave = f"{ref.year}-{ref.month:02d}"
        if chave <= fz["ultimo"]["mes"]:
            break
        pdf = None
        for suf in ("residencial-venda", "residencial-venda-pub", "residencial-venda-publico"):
            try:
                b = baixar(f"https://downloads.fipe.org.br/indices/fipezap/fipezap-{ref.year}{ref.month:02d}-{suf}.pdf")
                if b[:4] == b"%PDF":
                    pdf = b
                    break
            except Exception:
                pass
        if not pdf:
            continue
        texto = "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(pdf)).pages)
        valores = ler_fipezap(texto)
        if "itapema" not in valores:
            log.append(f"FipeZap {chave}: PDF baixado mas Itapema não encontrada, mantendo dado antigo")
            return
        novo = {"mes": chave, **valores}
        fz["ultimo"] = novo
        if ref.month == 12 and not any(p["mes"] == chave for p in fz["pontos"]):
            fz["pontos"].append(novo)
        log.append(f"FipeZap {chave}: " + ", ".join(f"{k} {v[0]}" for k, v in valores.items()))
        return
    log.append(f"FipeZap: nada novo (último {fz['ultimo']['mes']})")


# ---------------------------------------------------------------- CUB/SC
MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]


def atualizar_cub(d):
    html = baixar("https://sinduscon-fpolis.org.br/").decode("utf-8", "ignore")
    txt = sem_acento(re.sub(r"<[^>]+>", " ", html))
    txt = " ".join(txt.split())
    m = re.search(r"residencial medio de santa catarina (?:chega a|fica em|e de|atinge|alcanca|sobe para|cai para) r\$ ?(\d\.\d{3},\d{2}) em ([a-z]+)", txt)
    if not m or m.group(2) not in MESES:
        log.append("CUB: texto não encontrado no site do Sinduscon, mantendo dado antigo")
        return
    valor, mes = num_br(m.group(1)), MESES.index(m.group(2)) + 1
    ano = HOJE.year if mes <= HOJE.month + 1 else HOJE.year - 1
    chave = f"{ano}-{mes:02d}"
    v12 = re.search(r"(\d+,\d+)% em 12 meses", txt[m.start() - 300 : m.end() + 400])
    serie = dict(map(tuple, d["cub"]["serie"]))
    serie[chave] = valor
    d["cub"]["serie"] = [[k, serie[k]] for k in sorted(serie)]
    if v12 and chave == max(serie):
        d["cub"]["v12m"] = num_br(v12.group(1))
    log.append(f"CUB {chave}: R$ {valor:.2f}")


# ---------------------------------------------------------------- principal
def main():
    d = json.loads(ARQ_JSON.read_text(encoding="utf-8"))
    antes = json.dumps(d, sort_keys=True)
    for nome, fn in (("Banco Central", atualizar_bcb), ("FipeZap", atualizar_fipezap), ("CUB", atualizar_cub)):
        try:
            fn(d)
        except Exception as e:  # uma fonte fora do ar não derruba as outras
            if nome == "Banco Central":
                log.append(f"Banco Central: sem resposta deste servidor ({e}). Sem problema: o site busca o Banco Central direto no navegador; dados de reserva mantidos.")
            else:
                log.append(f"{nome}: ERRO {type(e).__name__}: {e}")
    if json.dumps(d, sort_keys=True) != antes:
        d["atualizado"] = HOJE.isoformat()
    ARQ_JSON.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    ARQ_JS.write_text("window.DADOS = " + json.dumps(d, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print("\n".join(log))
    return 0


if __name__ == "__main__":
    sys.exit(main())
