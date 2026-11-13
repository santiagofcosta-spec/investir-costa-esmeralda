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
                corpo = r.read()
                if corpo[:2] == bytes([0x1F, 0x8B]):  # resposta compactada (gzip)
                    import gzip
                    corpo = gzip.decompress(corpo)
                return corpo
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


# ---------------------------------------------------------------- Soja (Grão Direto)
GD = "https://www.graodireto.com.br"


def gd_dados(caminho):
    """Lê os dados estruturados (__NEXT_DATA__) de uma página pública do Grão Direto."""
    html = baixar(GD + caminho).decode("utf-8", "ignore")
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        raise RuntimeError(f"dados não encontrados em {caminho}")
    return json.loads(m.group(1))["props"]["pageProps"]


UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]


def slug_gd(nome):
    s = "".join(c for c in unicodedata.normalize("NFD", nome) if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def municipios_ibge():
    """Todos os municípios com UF e mesorregião (IBGE), em formato compacto: {uf: [[nome, idx_meso], ...]}."""
    dados = json.loads(baixar("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado", timeout=120))
    mesos, por_uf = [], {}
    for m in dados:
        meso = m["mesorregiao-nome"]
        if meso not in mesos:
            mesos.append(meso)
        por_uf.setdefault(m["UF-sigla"], []).append([m["municipio-nome"], mesos.index(meso)])
    for uf in por_uf:
        por_uf[uf].sort(key=lambda x: slug_gd(x[0]))
    return {"mesos": mesos, "uf": por_uf}


CIDADES_SOJA = [  # (uf, slug) das páginas públicas do Grão Direto
    ("mt", "comodoro"), ("mt", "campos-de-julio"), ("mt", "sapezal"), ("mt", "campo-novo-do-parecis"),
    ("mt", "diamantino"), ("mt", "nova-mutum"), ("mt", "lucas-do-rio-verde"), ("mt", "sorriso"), ("mt", "sinop"),
    ("mt", "querencia"), ("mt", "primavera-do-leste"), ("mt", "rondonopolis"),
    ("ro", "vilhena"), ("ro", "cerejeiras"), ("ro", "cabixi"), ("ro", "chupinguaia"), ("ro", "corumbiara"),
]


def gd_ofertas(pp):
    """Ofertas de compra (preço que os compradores pagam), disponível e entrega futura."""
    out = []
    for grupo in pp.get("offers", {}).get("purchase", {}).get("data", []):
        for o in grupo.get("offers", []):
            if not o.get("price"):
                continue
            cf = o.get("offerPriceWithFreight")
            out.append({
                "cidade": o.get("cityName"), "uf": o.get("state"), "preco": round(float(o["price"]), 2),
                "comFrete": round(float(cf), 2) if cf else None,
                "entrega": o.get("futureModalityDate") or None, "fob": bool(o.get("priceReferenceIsFob", 1)),
                "atualizado": (o.get("updatedAt") or "")[:16],
            })
    return out


def atualizar_soja(d):
    import time
    s = d.setdefault("soja", {})
    hoje = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) - dt.timedelta(hours=3)  # horário de Brasília
    dia = hoje.strftime("%Y-%m-%d")
    pp = gd_dados("/precos/soja/")
    regioes = [{"nome": r["description"], "valor": r["value"], "var": r.get("variation"), "data": r.get("updatedAt"),
                "pontos": r.get("chartPoints") or []}
               for r in pp["tableData"]["physicalMarket"] if (r.get("name") or "").lower() == "soja"]
    if len(regioes) < 5:
        raise RuntimeError("tabela de regiões veio incompleta")
    s["regioes"] = regioes
    cidades = s.setdefault("cidades", {})
    # migra o formato antigo (só Comodoro e Vilhena)
    if "comodoro" in s and isinstance(s["comodoro"], dict) and "serie" in s["comodoro"]:
        cidades.setdefault("comodoro", {})["serie"] = s.pop("comodoro")["serie"]
    if "vilhena" in s and isinstance(s["vilhena"], dict) and "historico" in s["vilhena"]:
        cidades.setdefault("vilhena", {})["historico"] = s.pop("vilhena")["historico"]
    ok = 0
    for uf, slug in CIDADES_SOJA:
        try:
            pc = gd_dados(f"/ofertas/soja/{uf}/{slug}/")
        except Exception as e:  # uma cidade fora do ar não derruba as outras
            log.append(f"Soja {slug}: {e}")
            continue
        c = cidades.setdefault(slug, {})
        c["nome"], c["uf"] = pc["city"]["name"], pc["city"]["state"]
        serie = dict(map(tuple, c.get("serie", [])))
        for q in pc.get("formattedQuotationIntraDayValues") or []:
            v = re.search(r"(\d+[.,]\d+)", q["value"].replace(".", "").replace(",", "."))
            dd, mm, aa = q["createdAt"].split("/")
            if v:
                serie[f"{aa}-{mm}-{dd}"] = float(v.group(1))
            m = re.search(r"\(([^)]+)\)", q.get("region") or "")
            if m:
                c["regiao"] = m.group(1)
        c["serie"] = [[k, serie[k]] for k in sorted(serie)][-600:]
        c["ofertas"] = gd_ofertas(pc)
        locais = [o["preco"] for o in c["ofertas"] if o["cidade"] == c["nome"]]
        hist = {h[0]: h for h in c.get("historico", [])}
        if locais:
            hist[dia] = [dia, min(locais), round(sum(locais) / len(locais), 2), max(locais), len(locais)]
        c["historico"] = [hist[k] for k in sorted(hist)][-600:]
        c["slug"], c["ordem"] = slug, [x[1] for x in CIDADES_SOJA].index(slug)
        ok += 1
        time.sleep(1)  # educação com o site
    if ok == 0:
        raise RuntimeError("nenhuma cidade carregou")
    # Brasil todo: página de cada estado traz cotações de regiões e de cidades
    estados = s.setdefault("estados", {})
    hc = s.setdefault("historicoCidades", {})
    ne = 0
    for uf in UFS:
        try:
            pe = gd_dados(f"/ofertas/soja/{uf.lower()}/")
        except Exception as e:
            log.append(f"Soja estado {uf}: {e}")
            continue
        ap = pe.get("averagePrices") or {}
        def lista(chave):
            out = []
            for r in (ap.get(chave) or {}).get("prices") or []:
                out.append({"nome": r.get("locationName"), "preco": round(float(r["price"]), 2), "var": r.get("variation"),
                            "data": (r.get("date") or "")[:10], "tipo": r.get("productName")})
            return out
        estados[uf] = {"nome": (pe.get("templateValues") or {}).get("state") or uf, "regioes": lista("regions"), "cidades": lista("cities")}
        for c in estados[uf]["cidades"]:
            k = f"{uf}|{c['nome']}"
            h = dict(map(tuple, hc.get(k, [])))
            if c["data"]:
                h[c["data"]] = c["preco"]
            hc[k] = [[x, h[x]] for x in sorted(h)][-180:]
        ne += 1
        time.sleep(1)
    # lista de municípios (IBGE) com mesorregião; renovada uma vez por mês
    mun = s.get("municipios")
    if not mun or mun.get("mes") != hoje.strftime("%Y-%m"):
        try:
            s["municipios"] = municipios_ibge()
            s["municipios"]["mes"] = hoje.strftime("%Y-%m")
        except Exception as e:
            log.append(f"Municípios IBGE: {e}")
    log.append(f"Soja Brasil: {ne}/27 estados, {sum(len(v['cidades']) for v in estados.values())} cidades com cotação")
    s["atualizado"] = hoje.strftime("%Y-%m-%d %H:%M")
    s["fonte"] = "Grão Direto (graodireto.com.br)"
    log.append(f"Soja: {ok}/{len(CIDADES_SOJA)} cidades, {len(regioes)} regiões")


# ---------------------------------------------------------------- principal
def main():
    d = json.loads(ARQ_JSON.read_text(encoding="utf-8"))
    antes = json.dumps(d, sort_keys=True)
    for nome, fn in (("Banco Central", atualizar_bcb), ("FipeZap", atualizar_fipezap), ("CUB", atualizar_cub), ("Soja", atualizar_soja)):
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
