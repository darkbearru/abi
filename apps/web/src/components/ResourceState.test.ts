import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ResourceState from './ResourceState.vue';

describe('ResourceState', () => {
  it('renders loading state', () => {
    const wrapper = mount(ResourceState, {
      props: { status: 'loading' }
    });

    expect(wrapper.text()).toContain('Loading...');
  });

  it('renders error state', () => {
    const wrapper = mount(ResourceState, {
      props: { status: 'error', error: 'Failed to load' }
    });

    expect(wrapper.text()).toContain('Failed to load');
  });

  it('renders empty state', () => {
    const wrapper = mount(ResourceState, {
      props: { status: 'success', empty: true, emptyText: 'Nothing here' }
    });

    expect(wrapper.text()).toContain('Nothing here');
  });

  it('renders default slot for available data', () => {
    const wrapper = mount(ResourceState, {
      props: { status: 'success' },
      slots: { default: '<div>Loaded content</div>' }
    });

    expect(wrapper.text()).toContain('Loaded content');
  });
});
