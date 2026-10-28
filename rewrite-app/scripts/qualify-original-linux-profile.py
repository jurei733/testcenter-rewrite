import json, pathlib, argparse, hashlib, zipfile

parser = argparse.ArgumentParser(description='Derive visual-only Linux references from verified Original capture archives.')
parser.add_argument('--archives', type=pathlib.Path, required=True)
args = parser.parse_args()
repo = pathlib.Path(__file__).resolve().parent.parent
provenance = json.loads((repo / 'scripts/fixtures/original-linux-chromium147-provenance.json').read_text())
families = {}
for family, artifact in provenance['archives'].items():
    archive = args.archives / artifact['file']
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == artifact['sha256'], f'Wrong {family} artifact bytes'
    with zipfile.ZipFile(archive) as z:
        indices = [name for name in z.namelist() if name.endswith('index.json')]
        assert len(indices) == 1
        families[family] = json.loads(z.read(indices[0]))
first = families['entry']
assert first['manifest']['appCommit'] == provenance['mergeCommit']
assert first['manifest']['source'] == json.loads((repo / 'scripts/fixtures/original-browser-source.json').read_text())
assert first['manifest']['platform'] == 'linux' and first['manifest']['architecture'] == 'x64'
assert first['manifest']['node'] == 22
for family, value in families.items():
    assert value['manifest'] == first['manifest']
    assert value['browserVersion'] == '147.0.7727.15' and value['browserMode'] == 'visible'
    assert value['failures'] == [] and all(c['success'] for c in value['captures'])
tasks = {item['task']: item for value in families.values() for item in value['captures']}
base = lambda name: json.loads((repo / f'scripts/fixtures/{name}.json').read_text())

def project(schema, actual):
    if isinstance(schema, dict):
        assert isinstance(actual, dict)
        return {key: project(value, actual[key]) for key, value in schema.items()}
    if isinstance(schema, list):
        assert len(schema) == len(actual)
        return [project(a, b) for a, b in zip(schema, actual)]
    return actual

fixtures = {}
notices = base('original-login-notices')['measurements']
for key, expected in notices.items():
    for field, task, suffix in [('capsLock', 'login', 'caps-on'), ('invalidCredentials', 'login', 'invalid'),
                                ('httpsParticipant', 'insecure-participant', 'https-notice'), ('httpsAdmin', 'insecure-admin', 'https-notice')]:
        actual = tasks[task]['data']['states'][f'{key}-{suffix}']['notice']
        assert actual['text'] == expected[field]['text']
        expected[field] = project(expected[field], actual)
fixtures['original-login-notices'] = {'measurements': notices}
fixtures['original-header-logo'] = {'measurements': {key: tasks['header-login']['data']['states'][f'{key}-header-tooltip']['tooltip']
    for key in base('original-header-logo')['measurements']}}
fixtures['original-starter-review-toasts'] = {'states': project(base('original-starter-review-toasts')['states'], tasks['starter']['data']['toastMetrics'])}

measurements = base('original-player-exit')['measurements']
for key, expected in measurements.items():
    actual = tasks['exit']['data']['states'][key]
    measurements[key] = project(expected, actual)
fixtures['original-player-exit'] = {'measurements': measurements}

for name, source_task in [('original-runtime-error', 'runtime'), ('original-runtime-error-contract', 'runtime-contract')]:
    fixture = base(name)
    cases = {}
    for key, expected in fixture['cases'].items():
        actual = tasks[source_task]['data']['states'][key]['collapsed']['dialog']
        cases[key] = {'collapsedDialog': {field: project(expected['collapsedDialog'][field], actual[field])
            for field in ('box', 'titleBox', 'contentBox', 'expansion', 'icon', 'actions')}}
        cases[key]['collapsedDialog']['buttons'] = [dict(box=project(e['box'], a['box'])) for e, a in zip(expected['collapsedDialog']['buttons'], actual['buttons'])]
    fixtures[name] = {'cases': cases}

cases = {}
for key, expected in base('original-player-version-error')['cases'].items():
    actual = tasks['version-missing' if key.startswith('missing-') else 'version-unsupported']['data']['states'][key]['collapsed']['dialog']
    cases[key] = {'collapsedDialog': {field: project(expected['collapsedDialog'][field], actual[field])
        for field in ('box', 'titleBox', 'contentBox', 'expansion', 'icon', 'actions')}}
    cases[key]['collapsedDialog']['buttons'] = [dict(box=project(e['box'], a['box'])) for e, a in zip(expected['collapsedDialog']['buttons'], actual['buttons'])]
fixtures['original-player-version-error'] = {'cases': cases}

cases = {}
for key, expected in base('original-paused-exit')['cases'].items():
    actual = tasks['paused-locked' if key.endswith('-locked') else 'paused']['data']['states'][key]['pausedSurface']
    cases[key] = {'pausedSurface': project(expected['pausedSurface'], actual)}
fixtures['original-paused-exit'] = {'cases': cases}

information, pixels = {}, {}
for key, expected in base('original-exit-completeness')['information'].items():
    theme, screen, progress = key.split('-')
    source_task = tasks['legacy-completeness' if progress == 'legacy' else 'completeness']
    source_key = f'{theme}-{screen}-header-none-{progress}'
    actual = source_task['data']['states'][source_key]['information']['dialog']
    information[key] = project(expected, actual)
    pixels[key] = source_task['closeButtonPixelSha256'][source_key]
    for leave in ('confirm', 'forbidden'):
        other = f'{theme}-{screen}-header-{leave}-{progress}'
        assert project(expected, source_task['data']['states'][other]['information']['dialog']) == information[key]
        assert source_task['closeButtonPixelSha256'][other] == pixels[key]
fixtures['original-exit-completeness'] = {'information': information, 'closeButtonPixelSha256': pixels}

fixtures['original-system-check-welcome'] = {'measurements': project(base('original-system-check-welcome')['measurements'], tasks['system-check-welcome']['data']['measurements'])}

profile = {'version': 1, 'source': first['manifest']['source'], 'platform': 'linux', 'architecture': 'x64', 'nodeMajor': 22,
    'browserVersion': first['browserVersion'], 'browserPackage': first['browserPackage'], 'browserMode': 'visible',
    'provenance': provenance,
    'unqualifiedCases': [], 'fixtures': fixtures}
target = repo / 'scripts/fixtures/original-linux-chromium147.json'
target.write_text(json.dumps(profile, ensure_ascii=False, indent=2) + '\n')
print(target, target.stat().st_size)
