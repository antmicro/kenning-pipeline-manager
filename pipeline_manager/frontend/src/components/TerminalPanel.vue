<template>
    <div ref="terminalWrapper" class="terminal-wrapper">
        <div class="container">
            <div ref="resizer" class="resizer" />
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
import { mouseDownHandler } from '../core/events';

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
    mounted() {
        this.$refs.resizer.addEventListener('mousedown', mouseDownHandler);
    },
    methods: {
        toggleExternalTerminal() {
            // Get height of terminal panel before change
            const terminalWrapperHeight = this.$refs.terminalWrapper.clientHeight;

            // 360px height for commands + 35px for termianl tabs = 395px
            const minTerminalPanelHeight = 395;

            this.isExternalTerminalOpen = !this.isExternalTerminalOpen;
            this.isPipelineManagerTerminalOpen = false;

            if (this.isExternalTerminalOpen) {
                this.$refs.terminalWrapper.style.height =
                    terminalWrapperHeight > minTerminalPanelHeight
                        ? `${terminalWrapperHeight}px`
                        : `${minTerminalPanelHeight}px`;
                this.$refs.resizer.style.pointerEvents = 'all';
                this.$refs.externalSpan.classList.add('active');
                this.$refs.pipelineSpan.classList.remove('active');
            } else {
                this.$refs.resizer.style.pointerEvents = 'none';
                this.$refs.terminalWrapper.style.height = 'unset';
                this.$refs.externalSpan.classList.remove('active');
                this.$refs.pipelineSpan.classList.remove('active');
            }
        },
        togglePipelineManagerTerminal() {
            // Get height of terminal panel before change
            const terminalWrapperHeight = this.$refs.terminalWrapper.clientHeight;
            // 360px height for commands + 35px for termianl tabs = 395px
            const minTerminalPanelHeight = 395;

            this.isPipelineManagerTerminalOpen = !this.isPipelineManagerTerminalOpen;
            this.isExternalTerminalOpen = false;

            if (this.isPipelineManagerTerminalOpen) {
                this.$refs.terminalWrapper.style.height =
                    terminalWrapperHeight > minTerminalPanelHeight
                        ? `${terminalWrapperHeight}px`
                        : `${minTerminalPanelHeight}px`;
                this.$refs.resizer.style.pointerEvents = 'all';
                this.$refs.externalSpan.classList.remove('active');
                this.$refs.pipelineSpan.classList.add('active');
            } else {
                this.$refs.resizer.style.pointerEvents = 'none';
                this.$refs.terminalWrapper.style.height = 'unset';
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

                this.$refs.resizer.style.pointerEvents = 'none';
                this.$refs.terminalWrapper.style.height = 'unset';
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
    min-height: 35px;
    border-top: 1px solid $gray-500;
    bottom: 0;
    width: 100%;
    transition: transform 1s;
    display: flex;
    flex-direction: column;
}

.container {
    position: relative;
    height: 35px;
    min-height: 35px;
    background-color: $gray-600;
    /* Calculation to prevent panel overflow */
    width: calc(100% - 2 * #{$spacing-xxl});
    display: flex;
    padding: 0 $spacing-xxl;
    align-items: center;
    justify-content: space-between;

    & > .resizer {
        position: absolute;
        height: 5px;
        width: 100%;
        top: 0;
        cursor: row-resize;
        pointer-events: none;
    }

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
