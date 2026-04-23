"""BCAL command-line interface — ``bcal <command> …``.

Implemented with Typer for automatic ``--help`` and shell-completion.
All commands are idempotent and safe to run multiple times.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from bcal import __version__
from bcal.profiles import RegulatoryProfile, load_profile
from bcal.report import write_csv, write_json, write_markdown, write_pdf
from bcal.schema import StatisticalEvidencePackage, dump_json_schema

app = typer.Typer(
    name="bcal",
    help="BioCompliance Audit Layer — generate and verify Statistical Evidence Packages.",
    no_args_is_help=True,
    add_completion=True,
    rich_markup_mode="rich",
)
console = Console()


@app.callback()
def _main() -> None:
    """BCAL — BioCompliance Audit Layer."""


@app.command()
def version() -> None:
    """Print the installed BCAL version."""
    typer.echo(__version__)


@app.command()
def schema(
    out: Annotated[
        Path | None,
        typer.Option("--out", "-o", help="Write the JSON schema to this file."),
    ] = None,
) -> None:
    """Print (or write) the SEP JSON Schema."""
    data = dump_json_schema()
    payload = json.dumps(data, indent=2, sort_keys=True)
    if out:
        out.write_text(payload + "\n", encoding="utf-8")
        console.print(f"[green]✓[/] schema written to [bold]{out}[/]")
    else:
        typer.echo(payload)


@app.command()
def audit(
    path: Annotated[Path, typer.Option("--path", "-p", help="Pipeline output root.")],
    config: Annotated[
        Path | None,
        typer.Option("--config", "-c", help="YAML config with module toggles."),
    ] = None,
    profile: Annotated[
        str,
        typer.Option("--profile", help="Regulatory profile to apply."),
    ] = "fda_ind",
    out_dir: Annotated[
        Path,
        typer.Option("--out-dir", "-o", help="Where to write SEP artefacts."),
    ] = Path("audit_output"),
    pipeline_name: Annotated[
        str,
        typer.Option(
            "--pipeline-name",
            help="Pipeline display name (auto-inferred from path if omitted).",
        ),
    ] = "unknown-pipeline",
    pipeline_version: Annotated[
        str,
        typer.Option("--pipeline-version", help="Pipeline version string."),
    ] = "0.0.0",
    operator: Annotated[
        str,
        typer.Option("--operator", help="Human or service operator identity."),
    ] = "cli",
) -> None:
    """Run a minimal audit against a pipeline output directory.

    This is a scaffold that exercises the capture API and writes all four
    report formats. Real-world usage wires in Nextflow/Snakemake metadata and
    supplies sample-level data to the M1/M4/M5 modules via the Python API.
    """
    from bcal.instrument import Instrument

    if not path.exists():
        raise typer.BadParameter(f"Pipeline path does not exist: {path}")

    prof: RegulatoryProfile = load_profile(profile)
    console.print(
        Panel.fit(
            f"[bold]{prof.name}[/] ([dim]{prof.code}[/])\n{prof.description}",
            title="Regulatory Profile",
        )
    )

    # For the CLI smoke-run we treat the contents of the pipeline root as the
    # input manifest. Real pipelines should call the Instrument API directly.
    patterns = [str(path / "**" / "*")]
    with Instrument(
        pipeline_name=pipeline_name,
        version=pipeline_version,
        operator=operator,
    ) as inst:
        inst.hash_inputs(patterns)
        inst.add_checklist_items(prof.checklist)
        if config is not None:
            inst.capture_tool_version("bcal-config", config.name)
        sep = inst.seal()

    _emit(sep, out_dir)


@app.command()
def verify(
    sep_path: Annotated[Path, typer.Argument(help="Path to a SEP JSON file.")],
) -> None:
    """Recompute the seal over a SEP JSON file and compare."""
    sep = StatisticalEvidencePackage.from_json(sep_path)
    recomputed = sep.compute_seal()
    if sep.seal == recomputed:
        console.print(f"[green]✓[/] seal OK — [bold]{sep.id}[/] (seal={sep.seal[:12]}…)")
    else:
        console.print("[red]✗ SEAL MISMATCH[/]")
        console.print(f"  stored:      [red]{sep.seal}[/]")
        console.print(f"  recomputed:  [yellow]{recomputed}[/]")
        raise typer.Exit(code=2)


@app.command("seal")
def seal_cmd(
    sep_path: Annotated[Path, typer.Argument(help="Path to a SEP JSON file.")],
    out: Annotated[
        Path | None,
        typer.Option("--out", "-o", help="Write the sealed SEP here (default: stdout)."),
    ] = None,
) -> None:
    """(Re)compute the seal for a SEP JSON file."""
    sep = StatisticalEvidencePackage.from_json(sep_path)
    sep.seal = sep.compute_seal()
    if out:
        write_json(sep, out)
        console.print(f"[green]✓[/] sealed SEP written to [bold]{out}[/]")
    else:
        typer.echo(sep.to_json())


@app.command()
def report(
    sep_path: Annotated[Path, typer.Argument(help="Path to a SEP JSON file.")],
    out_dir: Annotated[
        Path,
        typer.Option("--out-dir", "-o", help="Output directory for reports."),
    ] = Path("audit_output"),
) -> None:
    """Regenerate Markdown / CSV / PDF reports from an existing SEP JSON."""
    sep = StatisticalEvidencePackage.from_json(sep_path)
    _emit(sep, out_dir)


@app.command()
def profiles() -> None:
    """List built-in regulatory profiles."""
    from bcal.profiles import list_profiles

    table = Table(title="Regulatory Profiles")
    table.add_column("Code", style="bold cyan")
    table.add_column("Name")
    table.add_column("Description")
    for p in list_profiles():
        table.add_row(p.code, p.name, p.description)
    console.print(table)


def _emit(sep: StatisticalEvidencePackage, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = write_json(sep, out_dir / f"{sep.id}.json")
    md_path = write_markdown(sep, out_dir / f"{sep.id}.md")
    csv_path = write_csv(sep, out_dir / f"{sep.id}-findings.csv")
    pdf_path, fmt = write_pdf(sep, out_dir / f"{sep.id}.pdf")

    table = Table(title=f"SEP {sep.id}")
    table.add_column("Artefact", style="cyan")
    table.add_column("Path")
    table.add_row("JSON", str(json_path))
    table.add_row("Markdown", str(md_path))
    table.add_row("CSV", str(csv_path))
    table.add_row(f"{fmt.upper()}", str(pdf_path))
    console.print(table)


def main() -> None:  # pragma: no cover - CLI shim
    """Entry point for ``python -m bcal`` and the installed script."""
    app()


if __name__ == "__main__":  # pragma: no cover
    main()
    sys.exit(0)
