"""Run with Python; requires Blender on PATH. Builds only in a temporary directory."""
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
# Linear RGB values from the original approved station GLB.
EXPECTED = {
    'roof': (0.0865004584, 0.1980693191, 0.1980693191, 1),
    'timber': (0.2541520894, 0.1714411080, 0.0802198201, 1),
    'paper': (0.7835378051, 0.6239603758, 0.3662526011, 1),
}

with tempfile.TemporaryDirectory(prefix='station-export-test-') as temporary:
    root = Path(temporary)
    (root / 'scripts').mkdir()
    (root / 'dist').mkdir()
    script = root / 'scripts/build-station.py'
    shutil.copyfile(ROOT / 'scripts/build-station.py', script)
    subprocess.run(
        ['blender', '--background', '--python-exit-code', '1', '--python', str(script)],
        check=True,
    )
    data = (root / 'dist/assets/station.glb').read_bytes()
    length, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A, 'GLB starts with its JSON chunk'
    document = json.loads(data[20:20 + length])
    materials = {material['name']: material for material in document['materials']}
    for name, expected in EXPECTED.items():
        actual = materials[name].get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])
        assert len(actual) == 4 and all(
            math.isclose(a, e, abs_tol=1e-6) for a, e in zip(actual, expected)
        ), f'{name}: exported color {actual} differs from {expected}'
    assert (root / 'assets-source/station.blend').is_file(), 'Editable source is generated'
    print('Station export colors passed:', ', '.join(EXPECTED))
