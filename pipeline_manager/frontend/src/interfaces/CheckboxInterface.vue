<!-- eslint-disable vue/no-mutating-props -->
<template>
    <div
        class="baklava-checkbox"
        :class="{ '--checked': intf.value }"
        :style="{ cursor: intf.readonly ? 'default' : null }"
        :title="intf.name"
        @click="intf.value = intf.readonly ? intf.value : !intf.value"
    >
        <div class="__checkmark-container">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
                <path class="__checkmark" d="M 6 5 L 6 10 L 16 10" transform="rotate(-45 10 10)" />
            </svg>
        </div>
        <div class="__label">
            {{ intf.name }}
        </div>
    </div>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
    props: {
        intf: {
            required: true,
        },
    },
});
</script>
