from pathlib import Path
import tarfile
base=Path('artifacts/analysis-detail-layout').resolve()
root=base/'linux-dist'
assert not root.exists(), 'new owned output only'
with tarfile.open(base/'linux-artifact'/'artifact.tar') as bundle:
    members=bundle.getmembers()
    for m in members:
        assert (root/m.name).resolve().is_relative_to(root), m.name
        assert m.isfile() or m.isdir(), m.name
    assert sum(m.isfile() for m in members)==26
    bundle.extractall(root,members=members,filter='data')
print('PASS:actual Linux26 regular files extracted within owned proof directory/no links')
