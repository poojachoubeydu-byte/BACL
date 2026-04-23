"""PDF emission with graceful fallback.

WeasyPrint is an **optional** dependency. If it's not installed we render the
Markdown to an HTML shell and write that file instead, with a clear advisory
at the top. This keeps ``bcal`` installable (and the build *free* of native-
toolchain baggage) on CI runners that can't compile WeasyPrint's GTK deps.
"""

from __future__ import annotations

from pathlib import Path

from bcal.report.markdown_writer import render_markdown
from bcal.schema import StatisticalEvidencePackage

_HTML_SHELL = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>BCAL SEP — {sep_id}</title>
<style>
 :root {{
   --ivory: #FAF7F0;
   --cream: #F5EFE4;
   --gold: #C9A65B;
   --gold-soft: #E6D49A;
   --grey-900: #3C3A36;
   --grey-700: #5A5751;
   --grey-500: #8A857C;
   --grey-200: #E3DFD6;
   --grey-100: #EFECE4;
 }}
 body {{ font-family: 'Inter', system-ui, sans-serif; max-width: 820px; margin: 2em auto;
        color: var(--grey-900); line-height: 1.6; padding: 0 1.25em;
        background: var(--ivory); }}
 h1 {{ color: var(--grey-900); border-bottom: 2px solid var(--gold);
       padding-bottom: .3em; font-weight: 800; letter-spacing: -0.01em; }}
 h2 {{ margin-top: 2em; color: var(--grey-900); border-bottom: 1px solid var(--grey-200);
       padding-bottom: .2em; font-weight: 700; }}
 h3 {{ color: var(--grey-700); font-weight: 600; }}
 table {{ border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.92em;
         background: #ffffff; border-radius: 6px; overflow: hidden; }}
 th, td {{ border: 1px solid var(--grey-200); padding: .5em .7em; text-align: left; }}
 th {{ background: var(--cream); color: var(--grey-900); font-weight: 600; }}
 code {{ font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: .9em;
        background: var(--grey-100); color: var(--grey-900);
        padding: 1px 5px; border-radius: 3px; }}
 blockquote {{ border-left: 3px solid var(--gold); padding: .4em 1em; color: var(--grey-700);
              background: var(--cream); border-radius: 0 6px 6px 0; }}
 strong {{ color: var(--grey-900); }}
 a {{ color: #A8843E; }}
 .advisory {{ background: var(--gold-soft); border: 1px solid var(--gold);
             padding: .75em 1em; border-radius: 6px; margin-bottom: 1em;
             font-size: 0.9em; color: var(--grey-900); }}
</style></head><body>
{advisory}
{body}
</body></html>
"""


def _markdown_to_html(md: str) -> str:
    """Very small markdown → HTML pass (tables, headers, inline code).

    We deliberately avoid pulling in a full markdown dependency for PDF
    rendering: the template output we produce is restricted enough that
    line-by-line handling is safe and determines the visual style.
    """
    import html
    import re

    lines = md.splitlines()
    out: list[str] = []
    in_table = False
    header_emitted = False

    def close_table() -> None:
        nonlocal in_table, header_emitted
        if in_table:
            out.append("</table>")
            in_table = False
            header_emitted = False

    for raw in lines:
        line = raw.rstrip()
        if line.startswith("|") and line.endswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            # Separator row like |---|---|
            if all(set(c) <= {"-", ":"} for c in cells):
                header_emitted = True
                continue
            tag = "th" if not header_emitted and not in_table else "td"
            if not in_table:
                out.append('<table>')
                in_table = True
            out.append(
                "<tr>"
                + "".join(f"<{tag}>{_inline(c)}</{tag}>" for c in cells)
                + "</tr>"
            )
            continue
        close_table()
        if line.startswith("# "):
            out.append(f"<h1>{html.escape(line[2:])}</h1>")
        elif line.startswith("## "):
            out.append(f"<h2>{html.escape(line[3:])}</h2>")
        elif line.startswith("### "):
            out.append(f"<h3>{html.escape(line[4:])}</h3>")
        elif line.startswith("> "):
            out.append(f"<blockquote>{_inline(line[2:])}</blockquote>")
        elif line.startswith("- "):
            out.append(f"<li>{_inline(line[2:])}</li>")
        elif line == "":
            out.append("")
        else:
            out.append(f"<p>{_inline(line)}</p>")
    close_table()
    # Wrap runs of <li> in <ul>
    joined = "\n".join(out)
    joined = re.sub(
        r"(?:<li>.*?</li>\n?)+",
        lambda m: f"<ul>\n{m.group(0)}</ul>\n",
        joined,
        flags=re.DOTALL,
    )
    return joined


def _inline(text: str) -> str:
    import html
    import re

    escaped = html.escape(text)
    # `code`
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    # **bold**
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    # *italic*
    escaped = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", escaped)
    return escaped


def write_pdf(
    sep: StatisticalEvidencePackage,
    path: str | Path,
) -> tuple[Path, str]:
    """Render SEP to PDF if WeasyPrint is available, else HTML fallback.

    Returns ``(written_path, format)`` where format is ``"pdf"`` or ``"html"``.
    Always returns — never raises for a missing optional dep.
    """
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    md = render_markdown(sep)

    try:
        from weasyprint import HTML
    except ImportError:
        html_path = out.with_suffix(".html")
        html_doc = _HTML_SHELL.format(
            sep_id=sep.id,
            advisory=(
                '<div class="advisory">WeasyPrint is not installed; writing '
                "HTML fallback. Install <code>bcal[pdf]</code> for true PDF "
                "output.</div>"
            ),
            body=_markdown_to_html(md),
        )
        html_path.write_text(html_doc, encoding="utf-8")
        return html_path, "html"

    html_doc = _HTML_SHELL.format(
        sep_id=sep.id,
        advisory="",
        body=_markdown_to_html(md),
    )
    HTML(string=html_doc).write_pdf(str(out))
    return out, "pdf"
