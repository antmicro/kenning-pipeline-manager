<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->
<!--
    A header of Palette Section.
-->
<template>
    <div class="palette-section-header">
        {{ props.sectionName }}
    </div>
</template>

<script lang="ts" setup>
const props = defineProps<{sectionName: string}>();
</script>

<style lang="scss" scoped>
.palette-section-header {
    padding: 10px;
    text-align: center;
    border-bottom: 1px solid $gray-500;
}
</style>
