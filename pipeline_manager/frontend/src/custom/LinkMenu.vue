<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Interface that is used to display inputs, outputs and properties of a node.

The custom implementations introduces wrapper functions that prevent the user
from creating and deleting connections or altering nodes' values if the editor is read-only.
-->

<template>
    <transition name="slide-fade">
        <div ref="el">
                <a
                    v-for="url in nodeRef.URLs"
                    :key="url.name"
                    :href="url.url"
                    class="__url"
                    target="_blank"
                    draggable="false"
                    @pointerdown.left.stop
                >
                    <div class="link_item">
                        <img
                            v-if="url.icon !== undefined"
                            :src="getIconPath(url.icon)"
                            draggable="false"
                        />
                        <span>{{ url.name }}</span>
                        <br>
                    </div>
                </a>
        </div>
    </transition>
</template>

<script>
import { defineComponent, ref } from 'vue';
import { useViewModel } from '@baklavajs/renderer-vue';

export default defineComponent({
    props: {
        node: {
            required: true,
        },
    },
    setup(props) {
        const el = ref(null);
        const { viewModel } = useViewModel();
        const getIconPath = (name) => viewModel.value.cache[`./${name}`] ?? name;
        const nodeRef = ref(props.node);

        return {
            el,
            getIconPath,
            nodeRef,
        };
    },
});
</script>

<style lang='scss' scoped>
a {
    color: white;
    text-decoration: none;
    word-wrap: normal;
    width: 100%;

     > .link_item {
        border: 1px solid #737373;
        border-bottom: 0px solid;
        > img {
            display: inline-block;
            vertical-align: middle;
            margin: 1em 1em 1em 1em;
            width: auto;
            height: 100%;
            max-height: 1.75em;
        }

        > span {
            vertical-align: middle;
            font-size: $fs-small;
        }
        &:hover > span {
            color: $green;
        }
    }
}

</style>
