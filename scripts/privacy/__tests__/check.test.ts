import { describe, it, expect } from 'vitest';
import { checkDisclosures, type RepoSnapshot, type Model } from '../check';
import { renderPolicyTable, BEGIN, END } from '../policyTable';

const model: Model = {
  flows: [
    {
      id: 'daily_count',
      what: 'x',
      when: 'background',
      identifier: 'install_id',
      files: ['src/api/feedback.ts'],
      calls: ['track_daily_usage'],
      policyRows: [['Daily count', 'once a day', 'an install id']],
      stores: {
        apple: [{ type: 'User ID', purpose: 'Analytics', linked: true, tracking: false }],
        play: ['PSL_USER_ACCOUNT'],
        firefox: ['technicalAndInteraction'],
        cws: ['User activity'],
      },
    },
  ],
  exempt: [{ call: 'usage_stats', files: ['src/api/usageStats.ts'], why: 'admin' }],
  permissions: { ios: ['NSCameraUsageDescription'], android: ['INTERNET'] },
};

const csv = [
  'Question ID (machine readable),Response ID (machine readable),Response value,Answer requirement,Human-friendly question label',
  'PSL_DATA_TYPES_PERSONAL,PSL_USER_ACCOUNT,true,MAYBE_REQUIRED,Personal info/User IDs',
  'PSL_DATA_TYPES_PERSONAL,PSL_EMAIL,,MAYBE_REQUIRED,Personal info/Email address',
].join('\n');

function clean(): RepoSnapshot {
  return {
    srcFiles: {
      'src/api/feedback.ts': "await supabase.rpc('track_daily_usage', {})",
      'src/api/usageStats.ts': "await adminAuthClient\n    .rpc(\n  'usage_stats', args)",
    },
    supabaseCallers: ['src/api/feedback.ts'],
    firefoxOptional: ['technicalAndInteraction'],
    iosUsageKeys: ['NSCameraUsageDescription'],
    androidPermissions: ['INTERNET'],
    policyMd: `# Policy\n\n${BEGIN}\n${renderPolicyTable(model.flows)}\n${END}\n`,
    playCsv: csv,
  };
}

describe('checkDisclosures', () => {
  it('passes a consistent repo', () => {
    expect(checkDisclosures(clean(), model)).toEqual([]);
  });

  it('1. flags a Supabase call no flow or exemption describes', () => {
    const s = clean();
    s.srcFiles['src/api/new.ts'] = "supabase.rpc('zz_probe')";
    expect(checkDisclosures(s, model).join('\n')).toMatch(/zz_probe/);
  });

  it('1. flags a listed call that no longer exists', () => {
    const s = clean();
    s.srcFiles['src/api/feedback.ts'] = '// removed';
    expect(checkDisclosures(s, model).join('\n')).toMatch(/track_daily_usage/);
  });

  it('1. ignores tests', () => {
    const s = clean();
    s.srcFiles['src/api/__tests__/x.test.ts'] = "supabase.rpc('only_in_a_test')";
    expect(checkDisclosures(s, model)).toEqual([]);
  });

  it('2. flags a SUPABASE_CALLERS file no flow or exemption owns', () => {
    const s = clean();
    s.supabaseCallers.push('src/api/orphan.ts');
    expect(checkDisclosures(s, model).join('\n')).toMatch(/orphan\.ts/);
  });

  it('2. flags a flow file the privacy guard does not allow', () => {
    const s = clean();
    s.supabaseCallers = [];
    expect(checkDisclosures(s, model).join('\n')).toMatch(/SUPABASE_CALLERS.*feedback\.ts/s);
  });

  it('3. flags a Firefox manifest that declares more or less than the flows', () => {
    const s = clean();
    s.firefoxOptional = ['technicalAndInteraction', 'websiteContent'];
    expect(checkDisclosures(s, model).join('\n')).toMatch(/Firefox/);
  });

  it('4. flags a platform permission the source does not declare', () => {
    const s = clean();
    s.iosUsageKeys.push('NSLocationWhenInUseUsageDescription');
    s.androidPermissions = [];
    const out = checkDisclosures(s, model).join('\n');
    expect(out).toMatch(/NSLocationWhenInUseUsageDescription/);
    expect(out).toMatch(/INTERNET/);
  });

  it('5. flags a stale policy table', () => {
    const s = clean();
    s.policyMd = s.policyMd.replace('an install id', 'something else');
    expect(checkDisclosures(s, model).join('\n')).toMatch(/privacy:generate/);
  });

  it('5. flags a policy without the generated markers', () => {
    const s = clean();
    s.policyMd = '# Policy';
    expect(checkDisclosures(s, model).join('\n')).toMatch(/marker/i);
  });

  it('6. flags a Play type declared in one place but not the other', () => {
    const s = clean();
    s.playCsv = csv.replace('PSL_EMAIL,,', 'PSL_EMAIL,true,');
    expect(checkDisclosures(s, model).join('\n')).toMatch(/PSL_EMAIL/);
  });
});
