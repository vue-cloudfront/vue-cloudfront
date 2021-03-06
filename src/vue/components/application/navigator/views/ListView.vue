<template>
    <section class="list-view">

        <!-- Table header -->
        <div v-if="nodes.dir.length || nodes.file.length" class="header">
            <i class="fas fa-fw" style="opacity: 0">folder</i>

            <div class="name" @click="sort('name')">
                <span>Name</span>
                <i :class="`sort fas fa-fw fa-angle-${sortProps.name ? 'down' : 'up'}`"></i>
            </div>

            <div class="detail" @click="sort('lastModified')">
                <span>Last modified</span>
                <i :class="`sort fas fa-fw fa-angle-${sortProps.lastModified ? 'down' : 'up'}`"></i>
            </div>

            <div class="detail" @click="sort('size')">
                <span>Size</span>
                <i :class="`sort fas fa-fw fa-angle-${sortProps.size ? 'down' : 'up'}`"></i>
            </div>
        </div>

        <div ref="list"
             class="list"
             @scroll="scroll">

            <!-- Folders -->
            <div v-double-tap="() => updateLocation(node)"
                 v-for="node of sortedNodes.dir"
                 :key="node.id"
                 :class="{selected: selection.includes(node), dir: 1, cutted: cutted.includes(node)}"
                 :data-hash="node.id">

                <i :style="{color: node.color}" class="fas fa-fw fa-folder"></i>

                <div class="name" spellcheck="false">

                    <span v-content-editable="node === editable.node"
                          v-select-all="node === editable.node"
                          @keydown.enter.prevent="renameNode($event, node)">{{ node.name }}</span>

                    <i :class="{'fas fa-fw fa-star star': 1, visible: node.marked}" :style="{color: node.color}"></i>
                </div>

                <span v-if="$mediaDevice !== 'mobile'" class="detail">{{ $utils.formatDate('DD. MMM YYYY - HH:mm', node.lastModified) }}</span>
                <span v-if="$mediaDevice !== 'mobile'" class="detail">{{ directorySize(node.id) | readableByteCount }}</span>
            </div>

            <!-- Files -->
            <div v-double-tap="() => $store.commit('filepreview/show', {nodes: nodes.file, index})"
                 v-for="(node, index) of sortedNodes.file"
                 :key="node.id"
                 :class="{selected: selection.includes(node), file: 1, cutted: cutted.includes(node)}"
                 :data-hash="node.id">

                <i class="fas fa-fw fa-file"></i>
                <div class="name" spellcheck="false">

                    <span v-content-editable="node === editable.node"
                          v-select-all="node === editable.node"
                          @keydown.enter.prevent="renameNode($event, node)">{{ node.name }}</span>

                    <i :class="{'fas fa-fw fa-star star': 1, visible: node.marked}" :style="{color: node.color}"></i>
                </div>

                <span v-if="$mediaDevice !== 'mobile'" class="detail">{{ $utils.formatDate('HH:mm - DD. MMM YYYY', node.lastModified) }}</span>
                <span v-if="$mediaDevice !== 'mobile'" class="detail">{{ node.size | readableByteCount }}</span>
            </div>
        </div>

    </section>
</template>

<script>

    // Selectable plugin
    import Selectable from '../plugins/selectable';

    import shared from './shared';

    // Vuex stuff
    import {mapGetters} from 'vuex';

    export default {
        props: {
            nodes: {
                type: Object,
                default: () => ({file: [], dir: []})
            }
        },

        data() {
            return {
                fileLimit: 0,
                dirLimit: this.$config.visibleNodesChunkSize,

                sortProp: null,
                sortProps: {
                    name: false,
                    lastModified: false,
                    size: false
                }
            };
        },

        computed: {
            ...shared.computed,

            ...mapGetters({
                'directorySize': 'nodes/directorySize'
            }),

            sortedNodes() {
                const {sortProp, croppedNodes} = this;
                const file = [...croppedNodes.file];
                const dir = [...croppedNodes.dir];

                if (sortProp) {

                    /**
                     * Values which are used to toggle
                     * each sorting type individually.
                     */
                    const ra = this.sortProps[sortProp] ? -1 : 1;
                    const rb = ra * -1;

                    // Find correct sorting function
                    const sortFn = (a, b) => a[sortProp] > b[sortProp] ? ra : rb;

                    // Sort pre-calulated nodes and re-render everything
                    file.sort(sortFn);
                    dir.sort(sortFn);
                }

                return {file, dir};
            }
        },

        watch: {
            ...shared.watch
        },

        mounted() {
            this.riseVisibleArea();
        },

        updated() {
            Selectable.resolveSelectables();
        },

        methods: {
            ...shared.methods,

            sort(type) {

                // Toggle sort-direction to descending / ascending
                this.sortProps[type] = !this.sortProps[type];
                this.sortProp = type;
            }
        }
    };

</script>

<style lang="scss" scoped>

    .list-view {
        @include flex(column);
        flex-grow: 1;
    }

    .list {
        height: 0;
        flex-grow: 1;
        overflow: auto;
        padding-bottom: 2.5em;
    }

    .dir,
    .file {
        cursor: pointer;
        border: 1px solid transparent;
        padding: calc(0.075em + 2px) 0.5em 0.075em;
        margin-bottom: -1px;

        &.selected {
            border-color: RGBA(var(--focus-color), 0.7);
            background: RGBA(var(--focus-color), 0.1);
        }

        &.cutted {
            opacity: 0.75;
        }

        &:not(.selected):hover {
            border-color: RGBA(var(--focus-color), 0.3);
            background: RGBA(var(--focus-color), 0.05);
        }
    }

    .dir,
    .file,
    .header {
        @include flex(row, center);
        user-select: none;
        font-size: 0.8em;

        i {
            color: RGB(var(--primary-text-color));
            transition: all 0.3s;
            font-size: 1.25em;
            margin-bottom: 0.2em;
        }

        .name,
        .detail {
            color: RGB(var(--primary-text-color));
            transition: all 0.3s;
        }

        .name {
            width: 100%;
            margin: 0 0.5em;
            padding: 0.15em 0 0.15em 0.25em;
            font-weight: 600;
            border-bottom: 2px solid transparent;
            transition: all 0.3s;
            @include white-space-overflow;

            span[contenteditable=true] {
                border-color: RGB(var(--theme-primary));
                cursor: text;
                outline: none;
            }

            .star {
                font-size: 0.75em;
                margin-left: 0.5em;

                opacity: 0;
                transform: translateY(-0.25em);
                transition: all 0.3s;

                &.visible {
                    opacity: 1;
                    transform: translateY(-0.15em);
                }
            }
        }

        .detail {
            width: 60%;
            opacity: 0.8;
        }
    }

    .header {
        margin-top: 1.5em;
        padding-bottom: 1em;

        .name,
        .detail {
            @include flex(row, center);
            font-weight: 600;

            i {
                margin: 0;
            }

            &:hover {
                color: RGB(var(--theme-primary));

                .sort {
                    color: RGB(var(--theme-primary));
                }
            }

            .sort {
                font-size: 1em;
                margin-left: 0.25em;
            }
        }
    }

    @include mq-phones {
        .dir,
        .file {
            padding: calc(0.25em + 2px) 0.5em 0.25em;
        }

        .dir,
        .file,
        .header {
            font-size: 0.85em;

            .detail {
                display: none;
            }

            &.header {
                display: none;
            }
        }
    }

</style>
