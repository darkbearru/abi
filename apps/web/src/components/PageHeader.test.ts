import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PageHeader from './PageHeader.vue';

describe('PageHeader', () => {
  it('renders heading, eyebrow, description, and actions slot', () => {
    const wrapper = mount(PageHeader, {
      props: {
        title: 'Characters',
        eyebrow: 'World Bible',
        description: 'Merged project cast'
      },
      slots: {
        actions: '<button>Refresh</button>'
      }
    });

    expect(wrapper.text()).toContain('Characters');
    expect(wrapper.text()).toContain('World Bible');
    expect(wrapper.text()).toContain('Merged project cast');
    expect(wrapper.text()).toContain('Refresh');
  });
});
