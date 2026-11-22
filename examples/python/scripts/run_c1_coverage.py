import dis
import os
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def is_excluded(rel: str) -> bool:
    return rel.startswith("src/infrastructure/drivers/") or rel == "src/main.py"


def expected_branches(code):
    # PEP 649 lazy annotation code objects are not user-observable behavior.
    if code.co_name == "__annotate__":
        return {}
    branches = {}
    insns = list(dis.get_instructions(code))
    for idx, ins in enumerate(insns):
        if "JUMP_IF_" in ins.opname or "POP_JUMP_IF_" in ins.opname:
            if idx >= 2 and insns[idx - 1].opname == "CHECK_EXC_MATCH" and insns[idx - 2].argval == "Exception":
                continue
            # Skip CPython specialization guards (e.g. builtin `tuple` identity fast path).
            if idx >= 2 and insns[idx - 1].opname == "IS_OP" and insns[idx - 2].opname == "LOAD_COMMON_CONSTANT":
                continue
            next_idx = idx + 1
            # Python 3.14 emits NOT_TAKEN pseudo-instructions before the fallthrough target.
            while next_idx < len(insns) and insns[next_idx].opname == "NOT_TAKEN":
                next_idx += 1
            fallthrough = insns[next_idx].offset if next_idx < len(insns) else None
            branches[(code, ins.offset)] = {ins.argval, fallthrough} - {None}
    for const in code.co_consts:
        if hasattr(const, "co_code"):
            branches.update(expected_branches(const))
    return branches


def run():
    tool_id = 3
    observed = {}
    src_root = str((ROOT / "src").resolve())

    def on_branch_keep(code, offset, dst):
        fn = os.path.abspath(code.co_filename)
        if fn.startswith(src_root):
            observed.setdefault((code, offset), set()).add(dst)

    sys.monitoring.use_tool_id(tool_id, "ai_ddd_py_c1")
    sys.monitoring.register_callback(tool_id, sys.monitoring.events.BRANCH, on_branch_keep)
    sys.monitoring.set_events(tool_id, sys.monitoring.events.BRANCH)

    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests" / "unit"), pattern="test_*.py")
    res = unittest.TextTestRunner(verbosity=2).run(suite)

    sys.monitoring.set_events(tool_id, 0)
    sys.monitoring.free_tool_id(tool_id)

    if not res.wasSuccessful():
        sys.exit(1)

    misses = []
    checked_files = 0
    for py_file in sorted((ROOT / "src").rglob("*.py")):
        rel = py_file.relative_to(ROOT).as_posix()
        if is_excluded(rel) or py_file.name == "__init__.py":
            continue
        checked_files += 1
        code = compile(py_file.read_text(encoding="utf-8"), str(py_file.resolve()), "exec")
        obs_by_line = {}
        for (ocode, ooffset), dsts in observed.items():
            if os.path.abspath(ocode.co_filename) == str(py_file.resolve()):
                obs_by_line[(ocode.co_firstlineno, ocode.co_name, ooffset)] = dsts
        for (bcode, boffset), targets in expected_branches(code).items():
            seen = obs_by_line.get((bcode.co_firstlineno, bcode.co_name, boffset), set())
            missing = targets - seen
            if missing:
                misses.append(f"{rel}:{bcode.co_firstlineno} ({bcode.co_name}) offset {boffset} missing branch target(s) {missing}")

    if misses:
        print("C1 Branch Coverage FAILED (must be 100% outside exclusions):", file=sys.stderr)
        for m in misses:
            print("  -", m, file=sys.stderr)
        sys.exit(1)

    print(f"PASS: 100% C1 branch coverage verified across {checked_files} non-excluded Python files.")


if __name__ == "__main__":
    run()
