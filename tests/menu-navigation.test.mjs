import test from 'node:test';
import assert from 'node:assert/strict';
import {focusMenuItem} from '../src/ui/menu-navigation.js';

function menuFixture() {
  let focused;
  const button = (name, {hidden = false, invisible = false, disabled = false} = {}) => ({
    name, disabled, invisible,
    getClientRects: () => hidden ? [] : [{}],
    focus() { focused = this.name; },
  });
  const controls = [
    button('mobile-close', {hidden: true}),
    button('first'), button('disabled', {disabled: true}),
    button('invisible', {invisible: true}), button('middle'), button('last'),
  ];
  return {
    controls,
    menu: {querySelectorAll: () => controls.filter(item => !item.disabled)},
    focus: (key, active) => { focusMenuItem({querySelectorAll: () => controls.filter(item => !item.disabled)}, key, active); return focused; },
  };
}

test('desktop menu arrows enter visible choices, skipping hidden sheet controls and unavailable choices', t => {
  const original = globalThis.getComputedStyle;
  globalThis.getComputedStyle = element => ({visibility: element.invisible ? 'hidden' : 'visible'});
  t.after(() => { globalThis.getComputedStyle = original; });
  const fixture = menuFixture();
  const trigger = {};
  assert.equal(fixture.focus('ArrowDown', trigger), 'first');
  assert.equal(fixture.focus('ArrowUp', trigger), 'last');
  assert.equal(fixture.focus('ArrowDown', fixture.controls[1]), 'middle');
  assert.equal(fixture.focus('ArrowDown', fixture.controls[5]), 'first');
  assert.equal(fixture.focus('ArrowUp', fixture.controls[1]), 'last');
  assert.equal(fixture.focus('Home', fixture.controls[5]), 'first');
  assert.equal(fixture.focus('End', fixture.controls[1]), 'last');
});

test('mobile sheet close control remains keyboard reachable when visible; empty menus are safe', t => {
  const original = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({visibility: 'visible'});
  t.after(() => { globalThis.getComputedStyle = original; });
  const fixture = menuFixture();
  fixture.controls[0].getClientRects = () => [{}];
  assert.equal(fixture.focus('Home', {}), 'mobile-close');
  assert.doesNotThrow(() => focusMenuItem({querySelectorAll: () => []}, 'ArrowUp', {}));
});
