#!/usr/bin/env python3
"""Build configuration module for Orion build system"""

from ...common.module import CommandModule, ValidationError
from ...common.context import Context
from ...common.utils import run_command, log_info, log_success, join_paths, IS_WINDOWS


class ConfigureModule(CommandModule):
    produces = []
    requires = []
    description = "Configure build with GN"

    def validate(self, ctx: Context) -> None:
        if not ctx.chromium_src.exists():
            raise ValidationError(f"Chromium source not found: {ctx.chromium_src}")

        if not ctx.paths.gn_flags_file:
            raise ValidationError("GN flags file not set")

        flags_file = join_paths(ctx.root_dir, ctx.paths.gn_flags_file)
        if not flags_file.exists():
            raise ValidationError(f"GN flags file not found: {flags_file}")

    def execute(self, ctx: Context) -> None:
        log_info(f"\n⚙️  Configuring {ctx.build_type} build for {ctx.architecture}...")

        out_path = join_paths(ctx.chromium_src, ctx.out_dir)
        out_path.mkdir(parents=True, exist_ok=True)

        flags_file = join_paths(ctx.root_dir, ctx.paths.gn_flags_file)
        args_file = ctx.get_gn_args_file()

        args_content = flags_file.read_text()
        args_content += f'\ntarget_cpu = "{ctx.architecture}"\n'

        args_file.write_text(args_content)

        gn_cmd = "gn.bat" if IS_WINDOWS() else "gn"
        gn_args = [gn_cmd, "gen", ctx.out_dir]
        if ctx.build_type != "debug":
            gn_args.append("--fail-on-unused-args")
        run_command(gn_args, cwd=ctx.chromium_src)

        log_success("Build configured")
