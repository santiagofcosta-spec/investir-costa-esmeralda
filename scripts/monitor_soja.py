"""Monitor de ofertas de soja (Grão Direto) com aviso no WhatsApp (CallMeBot).

Olha as páginas públicas das cidades de CIDADES e avisa:
  - COMPRA (compradores): oferta nova, ou oferta que SUBIU de preço;
  - VENDA (vendedores): oferta nova, ou oferta que CAIU de preço;
  - às 18h (ou com --resumo): resumo do dia com a melhor compra e a menor venda de cada cidade.

A chave do WhatsApp vem das variáveis de ambiente CALLMEBOT_PHONE e CALLMEBOT_APIKEY
(segredos do GitHub ou do computador). Sem elas, a mensagem só é mostrada na tela (modo teste).

Uso:  python scripts/monitor_soja.py            (rodada normal)
      python scripts/monitor_soja.py --resumo   (força o resumo)
      python scripts/monitor_soja.py --teste    (não envia nada, só mostra)
"""
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import atualizar as A  # reaproveita gd_dados (com pausa no bloqueio 403)

CIDADES = [("ro", "vilhena", "Vilhena/RO"), ("mt", "comodoro", "Comodoro/MT"),
           ("mt", "campo-novo-do-parecis", "Campo Novo do Parecis/MT")]
HORA_RESUMO = 18
ARQ_ESTADO = Path(os.environ.get("MONITOR_SOJA_ESTADO") or A.RAIZ / "estado" / "monitor_soja.json")
MAX_AVISOS = 12  # por mensagem; o resto vira "e mais N"
ARQ_SITE = Path(os.environ.get("MONITOR_SOJA_SITE") or A.RAIZ / "dados" / "avisos_soja.json")  # lido pela aba Soja do site
DIAS_NO_SITE = 7


def gravar_site(hora, ok, novos=(), resumo=None):
    """Avisos que aparecem no site (aba Investidor Agro). Só dados públicos das ofertas, já limpos."""
    try:
        site = json.loads(ARQ_SITE.read_text(encoding="utf-8"))
    except Exception:
        site = {}
    lista = site.get("avisos", [])
    t = hora.strftime("%Y-%m-%d %H:%M")
    for tipo, lado, o, antes in novos:
        lista.append({"t": t, "lado": lado, "tipo": tipo, "preco": o["preco"], "antes": antes, "cidade": o["cidade"],
                      "uf": o["uf"], "entrega": o["entrega"], "fob": o["fob"], "sc": round(o["kg"] / 60) if o.get("kg") else None})
    limite = (hora - dt.timedelta(days=DIAS_NO_SITE)).strftime("%Y-%m-%d")
    site["avisos"] = [a for a in lista if a["t"] >= limite][-300:]
    site["cidades"] = [c[2] for c in CIDADES]
    site["verificado"] = t
    if ok:
        site["lido"] = t
    if resumo is not None:
        site["resumo"] = resumo
    ARQ_SITE.parent.mkdir(parents=True, exist_ok=True)
    ARQ_SITE.write_text(json.dumps(site, ensure_ascii=False, indent=1), encoding="utf-8")


def agora_brt():
    return dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) - dt.timedelta(hours=3)


def brl(v):
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def entrega(o):
    d = o.get("futureModalityDate")
    if not d:
        return "disponível"
    a, m = d[:7].split("-")
    return f"entrega {m}/{a[2:]}"


def limpo(v, n=40):
    """Texto vindo do Grão Direto: só letras, números e pontuação simples (nada de quebra de linha ou link)."""
    return re.sub(r"[^\w .'/-]", "", str(v or ""))[:n].strip()


def numero(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def ler_cidade(uf, slug):
    pp = A.gd_dados(f"/ofertas/soja/{uf}/{slug}/")
    out = {"compra": {}, "venda": {}}
    for lado, chave in (("compra", "purchase"), ("venda", "sale")):
        for grupo in (pp.get("offers", {}).get(chave) or {}).get("data", []) or []:
            for o in grupo.get("offers", []):
                if not o.get("price") or not o.get("id"):
                    continue
                out[lado][str(o["id"])] = {
                    "preco": round(float(o["price"]), 2), "cidade": limpo(o.get("cityName")), "uf": limpo(o.get("state"), 2),
                    "entrega": entrega(o), "fob": bool(o.get("priceReferenceIsFob", 1)),
                    "kg": numero(o.get("quantity")),
                }
    return out


def linha(lado, o, antes=None):
    txt = f"{brl(o['preco'])}"
    if antes is not None:
        seta = "▲" if o["preco"] > antes else "▼"
        txt = f"{brl(antes)} → {brl(o['preco'])} {seta}"
    extra = [o["entrega"]] if lado == "compra" else []
    if lado == "compra":
        extra.append("FOB" if o["fob"] else "CIF")
    if o.get("kg"):
        extra.append(f"{o['kg'] / 60:,.0f} sc".replace(",", "."))
    return f"{txt} · {o['cidade']}-{o['uf']} · {' · '.join(extra)}"


def enviar(texto, teste):
    fone, chave = os.environ.get("CALLMEBOT_PHONE"), os.environ.get("CALLMEBOT_APIKEY")
    if teste or not (fone and chave):
        print("---- mensagem (não enviada) ----\n" + texto + "\n--------------------------------")
        return
    url = "https://api.callmebot.com/whatsapp.php?" + urllib.parse.urlencode({"phone": fone, "text": texto, "apikey": chave})
    with urllib.request.urlopen(urllib.request.Request(url, headers=A.UA), timeout=60) as r:
        resp = r.read().decode("utf-8", "ignore")
    if r.status != 200 or "error" in resp.lower()[:400]:
        raise RuntimeError("CallMeBot recusou a mensagem (confira telefone e chave)")
    print("mensagem enviada")


def main():
    teste = "--teste" in sys.argv
    hora = agora_brt()
    dia = hora.strftime("%Y-%m-%d")
    try:
        est = json.loads(ARQ_ESTADO.read_text(encoding="utf-8"))
    except Exception:
        est = {}
    primeira = not any((est.get("ofertas") or {}).values())  # nada visto ainda (1ª rodada que leu algo)
    vistas = est.setdefault("ofertas", {"compra": {}, "venda": {}})
    dias = est.setdefault("dias", {})  # dia -> cidade -> {"compra_max":..., "venda_min":...}
    avisos = {"compra": [], "venda": []}
    atuais = {"compra": {}, "venda": {}}
    resumo_hoje = dias.setdefault(dia, {})
    falhas = []
    for i, (uf, slug, nome) in enumerate(CIDADES):
        try:
            of = ler_cidade(uf, slug)
            if not of["compra"] and not of["venda"]:  # página veio sem nada: trata como falha, não como "tudo saiu"
                raise RuntimeError("página sem nenhuma oferta")
        except Exception as e:
            falhas.append(f"{nome}: {e}")
            continue
        r = resumo_hoje.setdefault(nome, {})
        for lado in ("compra", "venda"):
            for oid, o in of[lado].items():
                atuais[lado][oid] = o
            precos = [o["preco"] for o in of[lado].values()]
            if precos:
                if lado == "compra":
                    r["compra_max"] = max(precos)
                    r.setdefault("compra_abertura", max(precos))
                else:
                    r["venda_min"] = min(precos)
                    r.setdefault("venda_abertura", min(precos))
        if i < len(CIDADES) - 1:
            time.sleep(4)
    if len(falhas) == len(CIDADES):
        print("Grão Direto não respondeu:", *falhas, sep="\n  ")
        # não mexe nas ofertas vistas: na próxima rodada compara com o que já tinha.
        # Avisa uma vez só, na 3ª rodada seguida sem resposta (evita mensagem a cada bloqueio passageiro).
        est["falhas_seguidas"] = est.get("falhas_seguidas", 0) + 1
        if est["falhas_seguidas"] == 3:
            enviar("⚠️ Monitor da soja: o Grão Direto não responde há 3 rodadas seguidas. "
                   "Sigo tentando e aviso de novo quando voltar.", teste)
        if not teste:
            ARQ_ESTADO.parent.mkdir(parents=True, exist_ok=True)
            ARQ_ESTADO.write_text(json.dumps(est, ensure_ascii=False, indent=1), encoding="utf-8")
            gravar_site(hora, ok=False)
        return 0
    if est.pop("falhas_seguidas", 0) >= 3:
        print("Grão Direto voltou a responder")
        voltou = True
    else:
        voltou = False
    # compara com o que já tinha visto (uma mesma oferta aparece em várias cidades vizinhas: id único)
    for lado in ("compra", "venda"):
        for oid, o in atuais[lado].items():
            antes = vistas[lado].get(oid)
            if antes is None:
                avisos[lado].append(("nova", o, None))
            elif lado == "compra" and o["preco"] > antes["preco"]:
                avisos[lado].append(("subiu", o, antes["preco"]))
            elif lado == "venda" and o["preco"] < antes["preco"]:
                avisos[lado].append(("caiu", o, antes["preco"]))
        # guarda as ofertas no ar; as que saíram ficam alguns dias para não avisar de novo se voltarem
        for oid, o in atuais[lado].items():
            vistas[lado][oid] = {**o, "visto": dia}
        limite = (hora - dt.timedelta(days=7)).strftime("%Y-%m-%d")
        for oid in [k for k, v in vistas[lado].items() if v.get("visto", dia) < limite]:
            del vistas[lado][oid]
    partes = ["✅ Monitor da soja: o Grão Direto voltou a responder."] if voltou else []
    if primeira:
        partes.append(f"Monitor da soja ligado: {len(atuais['compra'])} ofertas de compra e {len(atuais['venda'])} de venda "
                      f"em {', '.join(c[2] for c in CIDADES)} e vizinhas. A partir de agora aviso o que for novo.")
    else:
        rot = {"nova": "NOVA", "subiu": "SUBIU", "caiu": "CAIU"}
        for lado, titulo in (("compra", "🟢 COMPRA (compradores pagando)"), ("venda", "🔴 VENDA (vendedores pedindo)")):
            av = sorted(avisos[lado], key=lambda x: -x[1]["preco"] if lado == "compra" else x[1]["preco"])
            if av:
                linhas = [f"• {rot[t]}: {linha(lado, o, a)}" for t, o, a in av[:MAX_AVISOS]]
                if len(av) > MAX_AVISOS:
                    linhas.append(f"… e mais {len(av) - MAX_AVISOS}")
                partes.append(titulo + "\n" + "\n".join(linhas))
    fazer_resumo = "--resumo" in sys.argv or (hora.hour >= HORA_RESUMO and est.get("resumo_dia") != dia)
    if fazer_resumo:
        linhas = []
        for _, _, nome in CIDADES:
            r = resumo_hoje.get(nome, {})
            c, v = r.get("compra_max"), r.get("venda_min")
            dc = f" ({'+' if c - r['compra_abertura'] >= 0 else ''}{(c - r['compra_abertura']):.2f} no dia)".replace(".", ",") if c and r.get("compra_abertura") else ""
            dv = f" ({'+' if v - r['venda_abertura'] >= 0 else ''}{(v - r['venda_abertura']):.2f} no dia)".replace(".", ",") if v and r.get("venda_abertura") else ""
            linhas.append(f"*{nome}*\n  Melhor compra: {brl(c) + dc if c else '—'}\n  Menor venda: {brl(v) + dv if v else '—'}")
        partes.append(f"📋 Resumo da soja {hora.strftime('%d/%m')} (Grão Direto, ofertas da cidade e vizinhas, R$/sc 60 kg)\n" + "\n".join(linhas))
        est["resumo_dia"] = dia
    for d in [d for d in dias if d < (hora - dt.timedelta(days=10)).strftime("%Y-%m-%d")]:
        del dias[d]
    if falhas:
        print("Sem resposta:", *falhas, sep="\n  ")
    if partes:
        enviar("\n\n".join(partes) + "\n\ngraodireto.com.br", teste)
    else:
        print("nada novo")
    if not teste:
        ARQ_ESTADO.parent.mkdir(parents=True, exist_ok=True)
        ARQ_ESTADO.write_text(json.dumps(est, ensure_ascii=False, indent=1), encoding="utf-8")
        novos = [] if primeira else [(t, lado, o, a) for lado in ("compra", "venda") for t, o, a in avisos[lado]]
        resumo = {"dia": dia, "cidades": {nome: resumo_hoje.get(nome, {}) for _, _, nome in CIDADES}}
        gravar_site(hora, ok=True, novos=novos, resumo=resumo)
    return 0


if __name__ == "__main__":
    sys.exit(main())
