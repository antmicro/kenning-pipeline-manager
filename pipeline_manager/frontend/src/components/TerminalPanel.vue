<template>
    <div class="terminal-wrapper">
        <div class="container">
            <div class="tab">
                <button class="tab-item" @click="toggleExternalTerminal">
                    <span ref="externalSpan">Kenning</span>
                </button>
                <button class="tab-item" @click="togglePipelineManagerTerminal">
                    <span ref="pipelineSpan">Pipeline Manger</span>
                </button>
            </div>

            <button @click="toggleTerminal">
                <Arrow
                    v-if="!this.isExternalTerminalOpen && !this.isPipelineManagerTerminalOpen"
                    color="white"
                    scale="small"
                    rotate="up"
                />
                <Arrow v-else color="white" scale="small" rotate="left" />
            </button>
        </div>
        <Terminal
            v-if="this.isExternalTerminalOpen && !this.isPipelineManagerTerminalOpen"
            :terminal="this.TerminalType.EXTERNAL"
        />
        <Terminal
            v-if="!this.isExternalTerminalOpen && this.isPipelineManagerTerminalOpen"
            :terminal="this.TerminalType.PIPELINE"
        />
    </div>
</template>

<script>
import Terminal from './Terminal.vue';
import Arrow from '../icons/Arrow.vue';
import { TerminalType } from '../core/utils';

export default {
    components: {
        Arrow,
        Terminal,
    },
    data() {
        return {
            isExternalTerminalOpen: false, // toggle state of external terminal
            isPipelineManagerTerminalOpen: false, // toggle state of pipeline terminal
            TerminalType,
        };
    },
    methods: {
        toggleExternalTerminal() {
            this.isExternalTerminalOpen = !this.isExternalTerminalOpen;
            this.isPipelineManagerTerminalOpen = false;

            if (this.isExternalTerminalOpen) {
                this.$refs.externalSpan.classList.add('active');
                this.$refs.pipelineSpan.classList.remove('active');
            } else {
                this.$refs.externalSpan.classList.remove('active');
                this.$refs.pipelineSpan.classList.remove('active');
            }
        },
        togglePipelineManagerTerminal() {
            this.isPipelineManagerTerminalOpen = !this.isPipelineManagerTerminalOpen;
            this.isExternalTerminalOpen = false;

            if (this.isPipelineManagerTerminalOpen) {
                this.$refs.externalSpan.classList.remove('active');
                this.$refs.pipelineSpan.classList.add('active');
            } else {
                this.$refs.externalSpan.classList.remove('active');
                this.$refs.pipelineSpan.classList.remove('active');
            }
        },
        toggleTerminal() {
            if (!this.isExternalTerminalOpen && !this.isPipelineManagerTerminalOpen) {
                this.toggleExternalTerminal();
            } else {
                this.isExternalTerminalOpen = false;
                this.isPipelineManagerTerminalOpen = false;

                this.$refs.externalSpan.classList.remove('active');
                this.$refs.pipelineSpan.classList.remove('active');
            }
        },
    },
};
</script>

<style lang="scss" scoped>
.terminal-wrapper {
    position: absolute;
    bottom: 0;
    width: 100%;
    display: block;
    transition: transform 1s;
}

.container {
    height: 35px;
    background-color: $gray-600;
    /* Calculation to prevent panel overflow */
    width: calc(100% - 2 * #{$spacing-l});
    display: flex;
    padding: 0 $spacing-l;
    align-items: center;
    justify-content: space-between;

    & > .tab {
        display: flex;
        gap: 40px;

        & > .tab-item {
            color: $white;

            & > span {
                font-size: $fs-small;
                user-select: none;
            }

            & > span.active {
                color: $green;
            }
        }
    }
}
</style>
