"""Roda o monitor da soja no computador do Santiago (Agendador de Tarefas do Windows) e publica os avisos no site.

Por que no PC: desde 16/11/2026 o Grão Direto recusa (403) os servidores do GitHub; do PC funciona.

Fica numa CÓPIA SÓ DELE do repositório (C:\\Users\\pc\\monitor-soja\\repo), nunca na pasta de trabalho:
a cada rodada ele alinha a cópia com o GitHub (descartando qualquer coisa local), roda o monitor e,
se os avisos ou o resumo mudaram (ou se faz mais de 6 h que não envia), grava e envia só
dados/avisos_soja.json. O estado do monitor fica em estado/ (fora do Git).
Registro: C:\\Users\\pc\\monitor-soja\\monitor.log

Com --soja-site faz outra coisa (1x por dia, à noite): roda `atualizar.py --so-soja` (ofertas e cotações de
todas as cidades acompanhadas + varredura em rodízio) e envia dados/dados.json e dados/dados.js se mudaram.
"""
import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LOG = REPO.parent / "monitor.log"
ARQ = "dados/avisos_soja.json"
ENVIAR_SEM_MUDANCA_HORAS = 6  # mantém "verificado" recente no site mesmo sem novidade


def log(msg):
    linha = f"{dt.datetime.now():%Y-%m-%d %H:%M:%S} {msg}"
    try:
        antigo = LOG.read_text(encoding="utf-8").splitlines()[-2000:] if LOG.exists() else []
        LOG.write_text("\n".join(antigo + [linha]) + "\n", encoding="utf-8")
    except Exception:
        pass


def git(*args, ok=True):
    r = subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if ok and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {(r.stderr or r.stdout).strip()[:300]}")
    return r


def importante(j):
    j = j or {}
    return json.dumps({"avisos": j.get("avisos"), "resumo": j.get("resumo")}, sort_keys=True)


def soja_site():
    git("fetch", "-q", "origin", "main")
    git("reset", "-q", "--hard", "origin/main")
    r = subprocess.run([sys.executable, "scripts/atualizar.py", "--so-soja"], cwd=REPO, capture_output=True, text=True,
                       env={**os.environ, "PYTHONIOENCODING": "utf-8"}, timeout=3600,
                       encoding="utf-8", errors="replace", creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    saida = " | ".join(x.strip() for x in (r.stdout + r.stderr).splitlines() if x.strip())[-900:]
    log(f"soja do site: {saida or '(sem saída)'}")
    arqs = ["dados/dados.json", "dados/dados.js"]
    if r.returncode != 0 or not git("status", "--porcelain", "--", *arqs).stdout.strip():
        log("soja do site: nada enviado")
        git("checkout", "-q", "--", *arqs, ok=False)
        return 0 if r.returncode == 0 else 1
    git("add", *arqs)
    git("-c", "user.name=monitor-soja-pc", "-c", "user.email=monitor-soja@localhost",
        "commit", "-q", "-m", f"Soja do site, coletada no PC ({dt.datetime.now():%d/%m %H:%M})")
    for _ in range(3):
        if git("push", "-q", "origin", "HEAD:main", ok=False).returncode == 0:
            log("soja do site: enviada")
            return 0
        # o robô do GitHub pode ter salvo outros dados: junta; em conflito vale a soja recém-coletada (deste commit)
        if git("pull", "-q", "--rebase", "-X", "theirs", "origin", "main", ok=False).returncode != 0:
            git("rebase", "--abort", ok=False)
            break
        # dados.js é uma linha só: refaz a partir do dados.json já juntado, para não perder o que o robô salvou
        d = json.loads((REPO / "dados/dados.json").read_text(encoding="utf-8"))
        (REPO / "dados/dados.js").write_text("window.DADOS = " + json.dumps(d, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
        git("add", "dados/dados.js")
        git("-c", "user.name=monitor-soja-pc", "-c", "user.email=monitor-soja@localhost", "commit", "-q", "--amend", "--no-edit")
    log("soja do site: não consegui enviar para o GitHub")
    return 1


def main():
    if "--soja-site" in sys.argv:
        return soja_site()
    git("fetch", "-q", "origin", "main")
    git("reset", "-q", "--hard", "origin/main")  # cópia dedicada: o GitHub manda
    antes = json.loads(git("show", f"HEAD:{ARQ}", ok=False).stdout or "{}")
    r = subprocess.run([sys.executable, "scripts/monitor_soja.py"], cwd=REPO, capture_output=True, text=True,
                       env={**os.environ, "PYTHONIOENCODING": "utf-8"},
                       encoding="utf-8", errors="replace", creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    saida = " | ".join(x.strip() for x in (r.stdout + r.stderr).splitlines() if x.strip())[:600]
    log(f"monitor: {saida or '(sem saída)'}")
    if r.returncode != 0:
        log("monitor falhou; nada enviado")
        return 1
    try:
        depois = json.loads((REPO / ARQ).read_text(encoding="utf-8"))
    except Exception:
        log("sem arquivo de avisos; nada enviado")
        return 1
    ultimo = antes.get("verificado") or "2000-01-01 00:00"
    velho = (dt.datetime.now() - dt.datetime.strptime(ultimo, "%Y-%m-%d %H:%M")).total_seconds() > ENVIAR_SEM_MUDANCA_HORAS * 3600
    if importante(antes) == importante(depois) and not velho and not os.environ.get("MONITOR_PC_FORCAR"):
        git("checkout", "-q", "--", ARQ)  # só mudou o horário: não envia
        log("sem novidade; nada enviado")
        return 0
    git("add", ARQ)
    git("-c", "user.name=monitor-soja-pc", "-c", "user.email=monitor-soja@localhost",
        "commit", "-q", "-m", f"Avisos da soja ({dt.datetime.now():%d/%m %H:%M})")
    for _ in range(3):
        if git("push", "-q", "origin", "HEAD:main", ok=False).returncode == 0:
            log(f"enviado: {len(depois.get('avisos', []))} avisos na lista")
            return 0
        if git("pull", "-q", "--rebase", "origin", "main", ok=False).returncode != 0:
            git("rebase", "--abort", ok=False)
            break
    log("não consegui enviar para o GitHub")
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        log(f"ERRO {type(e).__name__}: {e}")
        sys.exit(1)
