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
ARQ_REFS = RAIZ / "dados" / "referencias.json"
ARQ_REFS_JS = RAIZ / "dados" / "referencias.js"
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
            bloqueio = e.code == 403 and "graodireto" in url  # Grão Direto bloqueia por alguns minutos quando vê pedidos demais
            if (e.code not in (304, 429, 500, 502, 503, 504) and not bloqueio) or i == tentativas - 1:
                raise
            if bloqueio or e.code == 429:
                time.sleep(90 * (i + 1))
                continue
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


CIDADES_SOJA = [  # (uf, slug) fixas, sempre consultadas e mostradas primeiro
    ("mt", "comodoro"), ("mt", "campos-de-julio"), ("mt", "sapezal"), ("mt", "campo-novo-do-parecis"),
    ("mt", "diamantino"), ("mt", "nova-mutum"), ("mt", "lucas-do-rio-verde"), ("mt", "sorriso"), ("mt", "sinop"),
    ("mt", "querencia"), ("mt", "primavera-do-leste"), ("mt", "rondonopolis"),
    ("ro", "vilhena"), ("ro", "cerejeiras"), ("ro", "cabixi"), ("ro", "chupinguaia"), ("ro", "corumbiara"),
]
# Além das fixas, o robô acompanha toda cidade onde já viu comprador com oferta (soja["acompanhar"]).
# A lista começou com uma varredura dos 5.571 municípios e cresce sozinha: cada página de cidade do
# Grão Direto mostra também ofertas das cidades vizinhas, e toda cidade nova que aparece entra na lista.
# Cidade sem nenhuma oferta local há mais de DIAS_SEM_OFERTA dias sai da lista (os dados guardados ficam).
DIAS_SEM_OFERTA = 120
# Varredura aos poucos do Brasil todo: dados/soja_sementes.json tem 1 município por microrregião (estados
# agrícolas) ou mesorregião (demais). Cada rodada visita SEMENTES_POR_RODADA delas, em rodízio; o que aparecer
# com comprador entra em soja["acompanhar"] e passa a ser consultado todo dia.
ARQ_SEMENTES = RAIZ / "dados" / "soja_sementes.json"
SEMENTES_POR_RODADA = 20


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


def atualizar_ultimas(c, dia):
    """Última oferta vista por mês de entrega. Se há ofertas no ar para o mês, guarda a melhor delas;
    se não há, mantém a última registrada (que saiu do Grão Direto)."""
    ult = c.setdefault("ultimas", {})
    hoje = {}
    for o in c.get("ofertas", []):
        k = o["entrega"][:7] if o.get("entrega") else "disp"
        if k not in hoje or o["preco"] > hoje[k]["preco"]:
            hoje[k] = {"preco": o["preco"], "cidade": o["cidade"], "uf": o["uf"], "fob": o["fob"], "visto": dia}
    ult.update(hoje)
    mes = dia[:7]
    for k in [k for k in ult if k != "disp" and k < mes]:  # entrega já passou
        del ult[k]


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
    acomp = s.setdefault("acompanhar", {})  # "uf|slug": último dia com oferta local
    fixas = {f"{uf}|{slug}" for uf, slug in CIDADES_SOJA}
    limite = (hoje - dt.timedelta(days=DIAS_SEM_OFERTA)).strftime("%Y-%m-%d")
    for k in [k for k, v in acomp.items() if v < limite and k not in fixas]:
        del acomp[k]
    fila = list(CIDADES_SOJA) + sorted(tuple(k.split("|")) for k in acomp if k not in fixas)
    vistos = set(fixas) | set(acomp)
    ok, novas, falhas = 0, 0, 0
    while fila:
        uf, slug = fila.pop(0)
        if falhas >= 3:  # bloqueado mesmo depois das pausas: para aqui e mantém os dados de ontem das demais
            log.append(f"Soja: Grão Direto bloqueou; {len(fila) + 1} cidades ficaram com os dados anteriores")
            break
        try:
            pc = gd_dados(f"/ofertas/soja/{uf}/{slug}/")
            falhas = 0
        except Exception as e:  # uma cidade fora do ar não derruba as outras
            log.append(f"Soja {slug}: {e}")
            falhas += getattr(e, "code", None) != 404
            if getattr(e, "code", None) == 404 and f"{uf}|{slug}" not in fixas:
                acomp.pop(f"{uf}|{slug}", None)  # página não existe com esse nome
            continue
        # fixas mantêm a chave antiga (só o nome); as demais levam a UF, pois há nomes repetidos entre estados
        c = cidades.setdefault(slug if f"{uf}|{slug}" in fixas else f"{uf}-{slug}", {})
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
        atualizar_ultimas(c, dia)
        locais = [o["preco"] for o in c["ofertas"] if o["cidade"] == c["nome"]]
        hist = {h[0]: h for h in c.get("historico", [])}
        if locais:
            hist[dia] = [dia, min(locais), round(sum(locais) / len(locais), 2), max(locais), len(locais)]
        c["historico"] = [hist[k] for k in sorted(hist)][-600:]
        fixa = [x[1] for x in CIDADES_SOJA]
        c["slug"], c["ordem"] = slug, fixa.index(slug) if slug in fixa else 99
        if locais:
            acomp[f"{uf}|{slug}"] = dia
        for o in c["ofertas"]:  # cidade vizinha com comprador que ainda não está na lista
            if not (o.get("cidade") and o.get("uf")):
                continue
            k = f"{o['uf'].lower()}|{slug_gd(o['cidade'])}"
            if k not in vistos:
                vistos.add(k)
                acomp[k] = dia
                fila.append(tuple(k.split("|")))
                novas += 1
        ok += 1
        time.sleep(4)  # educação com o site (pedidos rápidos demais levam bloqueio 403)
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
        time.sleep(4)
    # varredura em rodízio (por último: se o Grão Direto bloquear aqui, o resto já foi salvo)
    try:
        sementes = json.loads(ARQ_SEMENTES.read_text(encoding="utf-8"))
    except Exception:
        sementes = []
    if sementes:
        vz = s.setdefault("varredura", {"pos": 0, "voltas": 0})
        visitadas, achou, falhas = 0, 0, 0
        while visitadas < SEMENTES_POR_RODADA and falhas < 2:
            uf, slug = sementes[vz["pos"] % len(sementes)]
            vz["pos"] += 1
            if vz["pos"] % len(sementes) == 0:
                vz["voltas"] += 1
            visitadas += 1
            if f"{uf}|{slug}" in vistos:
                continue
            try:
                pc = gd_dados(f"/ofertas/soja/{uf}/{slug}/")
                falhas = 0
            except Exception as e:
                falhas += getattr(e, "code", None) != 404
                continue
            for o in gd_ofertas(pc):
                if o.get("cidade") and o.get("uf"):
                    k = f"{o['uf'].lower()}|{slug_gd(o['cidade'])}"
                    if k not in vistos:
                        vistos.add(k)
                        acomp[k] = dia
                        achou += 1
            time.sleep(4)
        vz["pos"] %= len(sementes)
        vz["dia"] = dia
        log.append(f"Soja varredura: {visitadas} regiões visitadas, {achou} cidades novas com comprador (posição {vz['pos']}/{len(sementes)}, voltas completas {vz['voltas']})")
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
    log.append(f"Soja: {ok} cidades com ofertas consultadas ({novas} novas), {len(regioes)} regiões")


# ---------------------------------------------------------------- principal
# ---------------------------------------------------------------- Cepea (soja Paranaguá)
def atualizar_cepea(refs):
    """Indicador da Soja Cepea/Esalq - Paranaguá: pega a linha mais recente da tabela pública."""
    html = baixar("https://www.cepea.org.br/br/indicador/soja.aspx").decode("utf-8", "replace")
    i = html.find('id="imagenet-indicador1"')
    if i < 0:
        raise ValueError("tabela do indicador Paranaguá não encontrada")
    m = re.search(r"<td>(\d{2}/\d{2}/\d{4})</td>\s*<td>([\d.,]+)</td>", html[i:i + 4000])
    if not m:
        raise ValueError("linha do indicador não reconhecida")
    data, valor = m.group(1), num_br(m.group(2))
    if not 50 < valor < 500:
        raise ValueError(f"valor fora do esperado: {valor}")
    h = refs["soja"]["hoje"]
    if h.get("data") != data or h.get("v") != valor:
        log.append(f"Cepea Paranaguá: R$ {valor:.2f} em {data}")
    h.update({"data": data, "v": valor, "txt": f"Indicador Cepea/Esalq Paranaguá, {data}", "atualizado": HOJE.isoformat()})


# ---------------------------------------------------------------- ITBI Porto Belo (Tesouro Nacional / SICONFI)
def itbi_ano(ente, ano):
    """ITBI arrecadado (receita bruta realizada) no ano, pela Declaração de Contas Anuais (DCA, Anexo I-C).
    Pega só a conta principal de impostos (1.1.1.2.08 até 2017, 1.1.1.8.01.4 de 2018 a 2021, 1.1.1.2.53 desde 2022);
    a linha de multas e juros (1.9...) fica de fora. None se o ano ainda não foi entregue."""
    url = f"https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio={ano}&no_anexo=DCA-Anexo%20I-C&id_ente={ente}"
    itens = json.loads(baixar(url).decode("utf-8")).get("items", [])
    achados = [x for x in itens if x["cod_conta"].startswith("RO1.1.1.") and "Inter Vivos" in x["conta"]
               and "Multa" not in x["conta"] and x["coluna"] == "Receitas Brutas Realizadas"]
    if not achados:
        return None
    return round(float(min(achados, key=lambda x: len(x["cod_conta"]))["valor"]), 2)  # a conta-mãe, não as subcontas


def atualizar_itbi(refs):
    r = refs["itbiPortoBelo"]
    serie = {a: v for a, v in r["serie"]}
    for ano in range(max(serie) + 1, HOJE.year):  # anos fechados ainda não carregados
        v = itbi_ano(r["ente"], ano)
        if v is None:
            continue  # a prefeitura entrega a DCA até 30/04 do ano seguinte
        if not 1e6 < v < 1e9:
            raise ValueError(f"ITBI {ano} fora do esperado: {v}")
        serie[ano] = v
        log.append(f"ITBI Porto Belo {ano}: R$ {v:,.2f}")
    r["serie"] = [[a, serie[a]] for a in sorted(serie)]
    r["atualizado"] = HOJE.isoformat()


def main():
    # --so-soja: só a soja (roda no PC do Santiago, porque o Grão Direto recusa os servidores do GitHub)
    so_soja = "--so-soja" in sys.argv
    d = json.loads(ARQ_JSON.read_text(encoding="utf-8"))
    antes = json.dumps(d, sort_keys=True)
    fontes = (("Soja", atualizar_soja),) if so_soja else (
        ("Banco Central", atualizar_bcb), ("FipeZap", atualizar_fipezap), ("CUB", atualizar_cub), ("Soja", atualizar_soja))
    for nome, fn in fontes:
        try:
            fn(d)
        except Exception as e:  # uma fonte fora do ar não derruba as outras
            if nome == "Banco Central":
                log.append(f"Banco Central: sem resposta deste servidor ({e}). Sem problema: o site busca o Banco Central direto no navegador; dados de reserva mantidos.")
            else:
                log.append(f"{nome}: ERRO {type(e).__name__}: {e}")
    if json.dumps(d, sort_keys=True) != antes:
        d["atualizado"] = HOJE.isoformat()
    if so_soja:
        ARQ_JSON.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
        ARQ_JS.write_text("window.DADOS = " + json.dumps(d, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
        print("\n".join(log))
        return 0
    refs = json.loads(ARQ_REFS.read_text(encoding="utf-8"))
    try:
        atualizar_cepea(refs)
    except Exception as e:
        log.append(f"Cepea: ERRO {type(e).__name__}: {e}")
    try:
        atualizar_itbi(refs)
    except Exception as e:
        log.append(f"ITBI: ERRO {type(e).__name__}: {e}")
    ARQ_REFS.write_text(json.dumps(refs, ensure_ascii=False, indent=1), encoding="utf-8")
    ARQ_REFS_JS.write_text("window.REFS_DADOS = " + json.dumps(refs, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    ARQ_JSON.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    ARQ_JS.write_text("window.DADOS = " + json.dumps(d, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print("\n".join(log))
    return 0


if __name__ == "__main__":
    sys.exit(main())
