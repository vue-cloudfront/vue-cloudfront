<template>
    <div class="index">

        <!-- Menu bar and the stuff right of it -->
        <menu-bar/>
        <div class="right-side">

            <!-- Info-bar, shows important messages -->
            <info-bar/>

            <!-- Tabs, dynamic, getting changed via menu tabs -->
            <navigator v-show="['marked', 'home', 'bin'].includes(activeTab)"/>

            <!-- Dashboard -->
            <dashboard v-show="activeTab === 'dashboard'"/>

            <!-- Settings -->
            <settings v-show="activeTab === 'settings'"/>

            <!-- Upload bar - shows the current upload progress of files -->
            <upload-toasts/>
        </div>

        <!-- Overlays -->
        <loading-screen/>
        <file-preview/>
        <authentication/>
        <upload-area/>
        <dialog-box/>

        <!-- Popovers -->
        <search-filters/>
        <keyboard-shortcuts/>
        <share-via-link/>

        <!-- Tooltip -->
        <tool-tip/>

        <div ref="styleStateIndicator" class="style-state-indicator"></div>

    </div>
</template>

<script>

    // Components
    import Navigator from './application/navigator/Navigator';
    import Dashboard from './application/dashboard/Dashboard';
    import Settings  from './application/settings/Settings';

    import ToolTip      from '../ui/specific/ToolTip';
    import MenuBar      from './application/MenuBar';
    import InfoBar      from './InfoBar';
    import UploadToasts from './UploadToasts';

    // Popovers
    import KeyboardShortcuts from './application/popup/keyboard-shortcuts/KeyboardShortcuts';
    import SearchFilters     from './application/popup/SearchFilters';
    import ShareViaLink      from './application/popup/ShareViaLink';

    // Overlays
    import DialogBox      from './application/overlay/DialogBox';
    import LoadingScreen  from './application/overlay/LoadingScreen';
    import UploadArea     from './application/overlay/UploadArea';
    import FilePreview    from './application/overlay/filepreview/FilePreview';
    import Authentication from './authentication/Authentication';

    // Vue stuff
    import Vue        from 'vue';
    import {mapState} from 'vuex';

    export default {

        components: {
            InfoBar,
            MenuBar,
            UploadToasts,

            // Tabs
            Navigator,
            Dashboard,

            // Popovers and static components
            KeyboardShortcuts,
            SearchFilters,
            ShareViaLink,
            LoadingScreen,
            UploadArea,
            ToolTip,
            Settings,
            FilePreview,
            DialogBox,

            // Authentication
            Authentication
        },

        data() {
            return {};
        },

        computed: {
            ...mapState(['activeTab'])
        },

        beforeCreate() {
            Vue.prototype.$mediaDevice = null;
        },

        mounted() {
            const {styleStateIndicator} = this.$refs;

            const checkAppliedStyles = () => {
                Vue.prototype.$mediaDevice = getComputedStyle(styleStateIndicator, ':before').content.replace(/"/g, '');
            };

            window.addEventListener('resize', checkAppliedStyles);
            checkAppliedStyles();

            if (this.$mediaDevice === 'mobile') {
                this.$store.commit('setActiveTab', 'home');
            }
        }
    };

</script>

<style lang="scss" scoped>

    .index {
        @include flex(row);
        font-family: $font-family;
        user-select: none;
        background: RGB(var(--primary-background-color));
        overflow: hidden;

        .right-side {
            @include flex(column);
            @include size(100%);
            overflow: hidden;
        }

        @include animate('0.75s ease-in-out') {
            from {
                transform: translateY(-1em);
            }
            to {
                filter: none;
                transform: none;
            }
        }
    }

    .style-state-indicator {
        display: none;

        &::before {
            content: 'desktop';

            @include mq-tablets {
                content: 'tablet';
            }

            @include mq-phones {
                content: 'mobile';
            }
        }
    }

    @include mq-phones {
        .index {
            flex-direction: column-reverse;
        }
    }

</style>
