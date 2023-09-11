<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Represents Loading Screen shown when JSON files
with specification and graph are being downloaded and loaded.
-->

<template>
  <div class="loading-screen">
    <SelfBuildingSquareSpinner
      id="loading-screen-spinner"
      :size="80"
    />
  </div>
</template>

<script>
import { SelfBuildingSquareSpinner } from 'epic-spinners';

export default {
    components: {
        SelfBuildingSquareSpinner,
    },
};
</script>

<style lang="scss">
.loading-screen {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;

  z-index: 99;
  background-color: #{$gray-600}80;
}

#loading-screen-spinner {
  & > .square {
    background: $green !important;
  }
}
</style>
