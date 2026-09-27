import { describe, expect, it } from 'vitest';
import { cutawayPlan, LIFT_M } from '../cutaway';

const storeys = [-2, -1, 0, 1, 2, 3, 4, 5].map((level, i) => ({
  level,
  elevation: i * 3.5,
  height: 3.5,
}));

describe('cutawayPlan', () => {
  it('lifts every storey above the target, keeps the target open and the rest solid', () => {
    const plan = cutawayPlan(storeys, 3);
    const role = (level: number) => plan.find((p) => p.level === level)?.role;
    expect([4, 5].map(role)).toEqual(['lifted', 'lifted']);
    expect(role(3)).toBe('target');
    expect([-2, -1, 0, 1, 2].map(role)).toEqual(['below', 'below', 'below', 'below', 'below']);
  });

  it('moves the lid up together, so the lifted storeys keep their stacking', () => {
    const plan = cutawayPlan(storeys, 1);
    const lifted = plan.filter((p) => p.role === 'lifted');
    expect(new Set(lifted.map((p) => p.offsetY))).toEqual(new Set([LIFT_M]));
    expect(plan.filter((p) => p.role !== 'lifted').every((p) => p.offsetY === 0)).toBe(true);
  });

  it('fades the lid, makes the target translucent and leaves the rest opaque', () => {
    const plan = cutawayPlan(storeys, 0);
    const by = (role: string) => plan.find((p) => p.role === role)!.opacity;
    expect(by('lifted')).toBeLessThan(by('target'));
    expect(by('target')).toBeLessThan(1);
    expect(by('below')).toBe(1);
  });

  it('cuts nothing when the floor is unknown or not in the model', () => {
    for (const target of [null, 9]) {
      const plan = cutawayPlan(storeys, target);
      expect(plan.every((p) => p.role === 'below' && p.offsetY === 0 && p.opacity === 1)).toBe(
        true
      );
    }
  });

  it('lifts nothing for the top storey, so the room still shows through the open top', () => {
    const plan = cutawayPlan(storeys, 5);
    expect(plan.some((p) => p.role === 'lifted')).toBe(false);
    expect(plan.find((p) => p.level === 5)?.role).toBe('target');
  });
});
