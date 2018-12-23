export const nodes = {

    namespaced: true,

    /**
     * Node-list (tree structure)
     */
    state: [],

    getters: {

        /**
         * Returns a object with file and folder props which are each
         * an array of nodes which are currently visible to the user.
         * This varies if the user is currently performing a search or is currently
         * viewing the marked nodes.
         */
        currentDisplayedNodes(state, getters, rootState) {

            /**
             * Return a function which expects as argument if the size
             * of each folder should be calculated.
             */
            return includeFolderSize => {
                const {selection, clipboard, editable, search, location} = rootState;
                const selectionNodes = selection;
                const clipboardNodes = clipboard.nodes;
                const editableNode = editable.node;

                /**
                 * The nodes which should be shown changed if
                 * the user performs a search of want to see all currently starred nodes.
                 */
                const nodes = (() => {
                    if (search.active) {
                        return search.nodes;
                    } else if (rootState.activeTab === 'marked') {
                        return state.filter(v => v.marked);
                    } else {
                        return state;
                    }
                })();

                const stateNodesAmount = nodes.length;
                const locHash = location.node && location.node.id;
                const ret = {file: [], dir: []}; // Seperate files and folders

                function calcFolderSize(hash) {
                    let size = 0;

                    // Find childrens of current location
                    for (let i = 0, n; n = nodes[i], i < stateNodesAmount; i++) {
                        if (n.parent === hash) {
                            const {type} = n;

                            // If folder, recursivly calculate it otherwise just append size
                            if (type === 'dir') {
                                size += calcFolderSize(n.id);
                            } else if (type === 'file') {
                                size += n.size;
                            }
                        }
                    }

                    return size;
                }

                // Find folder and files which has the current locations as parent
                // and calculate size
                const autoAdd = rootState.activeTab === 'marked' || search.active;
                for (let i = 0, n; n = nodes[i], i < stateNodesAmount; i++) {

                    // Check if parent is the current location
                    if (autoAdd || n.parent === locHash) {
                        const {type} = n;

                        // Pre calculations
                        n.cutted = clipboard.type === 'move' && clipboardNodes.includes(n);
                        n.selected = selectionNodes.includes(n);
                        n.editable = n === editableNode;
                        ret[type].push(n);

                        // Calculate recursivly the size of each folder
                        if (includeFolderSize && type === 'dir') {
                            n.size = calcFolderSize(n.id);
                        }

                        // Extract extension and raw name
                        if (type === 'file') {
                            const extensionCut = n.name.lastIndexOf('.');
                            n.extension = ~extensionCut ? n.name.substring(extensionCut + 1) : '?';
                        }
                    }
                }

                return ret;
            };
        }
    },

    actions: {

        /**
         * Updates / fetches nodes.
         * @param state
         * @param rootState
         * @param keepLocation If function should try to restore the previous location
         */
        async update({state, rootState}, {keepLocation = false} = {}) {

            // Fetch from server
            return this.dispatch('fetch', {
                route: 'update',
                body: {
                    apikey: rootState.auth.apikey
                }
            }).then(({nodes}) => {

                // Find root and try to restore location
                const root = nodes.find(v => v.parent === 'root');

                if (!root) {
                    throw 'Cannot examine root node.';
                }

                // Set location
                if (keepLocation) {
                    const locationId = rootState.location.node && rootState.location.node.id;
                    const locNode = locationId && nodes.find(v => v.id === locationId);
                    this.commit('location/update', locNode ? locNode : root);
                } else {
                    this.commit('location/update', root);
                }

                state.splice(0, state.length, ...nodes);
            });
        },

        /**
         * Creates a new folder within the parent.
         * @param state
         * @param destination Parent node
         */
        async createFolder({state, rootState}, destination) {

            // Fetch from server
            return this.dispatch('fetch', {
                route: 'createFolder',
                body: {
                    apikey: rootState.auth.apikey,
                    parent: destination.id
                }
            }).then(({node}) => {
                state.push(node);
                return node;
            });
        },

        /**
         * Move nodes to another folder.
         * @param rootState
         * @param nodes Nodes which should be moved
         * @param destination Destination node
         */
        async move({rootState}, {nodes, destination}) {

            // Prevent copy / move actions if search is active or user isn't at home or terminal
            if (rootState.search.active || (rootState.activeTab !== 'home' && rootState.activeTab !== 'terminal')) {
                return;
            }

            return this.dispatch('fetch', {
                route: 'move',
                body: {
                    apikey: rootState.auth.apikey,
                    nodes: nodes.map(v => v.id),
                    destination: destination.id
                }
            }).then(() => {

                // Update node locally to save ressources
                nodes.forEach(n => n.parent = destination.id);
            });
        },

        /**
         * Copy a node tree into another folder
         * @param state
         * @param rootState
         * @param nodes Nodes which should be copied
         * @param destination Destination node
         */
        async copy({state, rootState}, {nodes, destination}) {

            // If user is currently not at home, ignore action
            if (rootState.activeTab !== 'home') {
                return;
            }

            // Validate
            if (!Array.isArray(nodes)) {
                throw `Cannot perform 'copy' in nodes. nodes isn't an Array.`;
            }

            if (typeof destination !== 'object') {
                throw `Cannot perform 'copy' in nodes. destination isn't a Object.`;
            }

            // TODO: Centralized hash-gen?!
            const genHash = () => Math.round(Math.random() * 1e13).toString(16);

            /**
             * Clones a node-tree
             * @param node Entry node
             * @returns {Array} Cloned nodes
             */
            function cloneSiblings(node) {
                const siblings = [];

                /**
                 * Every node needs a new hash (and so the childs a new parent), otherwise
                 * each element would be copied in place.
                 */
                const newHash = genHash();

                for (let i = 0, n; n = state[i], i < state.length; i++) {
                    if (n.parent === node.id) {

                        // Copy sibling via spread syntax
                        siblings.push({...n});

                        if (n.type === 'dir') {
                            siblings.push(...cloneSiblings(n));
                        }

                        // Apply new hash from parent element
                        n.parent = newHash;
                    }
                }

                node.id = newHash;
                return siblings;
            }

            // Function to extract a name and extension from a filename
            const parseName = name => {
                const rdi = name.indexOf('.');
                const di = ~rdi ? rdi : name.length;
                return {name: name.substring(0, di), extension: name.substring(di, name.length)};
            };

            const spelledNumber = num => {
                switch (num) {
                    case 1:
                        return `${num}st`;
                    case 2:
                        return `${num}nd`;
                    case 3:
                        return `${num}rd`;
                    default:
                        return `${num}th`;
                }
            };

            // Clone nodes and add copy prefix
            const cloned = nodes.map(v => {

                // Extract name and extenstion
                const vParsed = parseName(v.name);
                const vName = vParsed.name;
                const vExtension = vParsed.extension;

                // Find previous copied versions
                let version = 1, match;
                for (let i = 0, n, l = state.length; n = state[i], i < l; i++) {

                    // Extract raw name without any extensions
                    const nParsed = parseName(n.name);
                    const nName = nParsed.name;

                    /**
                     * First, check if node is child of the current location, if yes
                     * and it starts with the current to-copy nodes name and
                     * has already a copy flag increase it.
                     */
                    if (n.parent === destination.id &&
                        n.name.startsWith(vName) &&
                        (match = nName.match(/\((([\d]+)(st|nd|rd|th) |)Copy\)$/))) {

                        // Check if node has been already multiple times copied
                        if (match[2]) {
                            const val = Number(match[2]);

                            // Check if version is above current
                            if (val && val >= version) {
                                version = val + 1;
                            }
                        }
                    }
                }

                return {
                    ...v,

                    // First copy gets only a '(Copy)' hint
                    name: `${vName} ${version ? ` (${spelledNumber(version)} ` : '('}Copy)${vExtension}`
                };
            });

            // Set new parent and clone siblings and push to nodes
            const searchActive = rootState.search.active;
            for (let i = 0, n, l = cloned.length; n = cloned[i], i < l; i++) {

                // Don't re-define parents if search is performed
                if (!searchActive) {
                    n.parent = destination.id;
                }

                cloned.push(...cloneSiblings(n));
            }

            // Append cloned nodes
            state.push(...cloned);
        },

        /**
         * Deletes nodes recursivly
         * @param nodes Nodes which should be deleted
         */
        async delete({rootState}, nodes) {
            return this.dispatch('fetch', {
                route: 'delete',
                body: {
                    apikey: rootState.auth.apikey,
                    nodes: nodes.map(v => v.id)
                }
            }).then(() => {

                // Update nodes
                return this.dispatch('nodes/update', {keepLocation: true});
            });
        },

        /**
         * Marks nodes. Can be viewed in the marked menu-section.
         * @param nodes Nodes which get a mark.
         */
        async addMark({rootState}, nodes) {
            return this.dispatch('fetch', {
                route: 'addMark',
                body: {
                    apikey: rootState.auth.apikey,
                    nodes: nodes.map(v => v.id)
                }
            }).then(() => {

                // Update node locally to save ressources
                for (let i = 0, n; n = nodes[i], i < nodes.length; i++) {
                    n.marked = true;
                }
            });
        },

        /**
         * Removes a mark from nodes.
         * @param nodes Nodes from which the mark gets removed.
         */
        async removeMark({rootState}, nodes) {
            return this.dispatch('fetch', {
                route: 'removeMark',
                body: {
                    apikey: rootState.auth.apikey,
                    nodes: nodes.map(v => v.id)
                }
            }).then(() => {

                // Update node locally to save ressources
                for (let i = 0, n; n = nodes[i], i < nodes.length; i++) {
                    n.marked = true;
                }
            });
        },

        /**
         * Renames a node.
         * @param rootState
         * @param node The node which should be renamed
         * @param newName A new name.
         */
        async rename({rootState}, {node, newName}) {
            return this.dispatch('fetch', {
                route: 'rename',
                body: {
                    apikey: rootState.auth.apikey,
                    target: node.id,
                    newName
                }
            }).then(() => {

                // Update node locally to save ressources
                node.lastModified = Date.now();
                node.name = newName;
            });
        },

        /**
         * Changes the color of folders.
         * @param state
         * @param nodes Nodes from which the color should be changed.
         * @param color A (basically) hex value like #fff (for white).
         */
        async changeColor({rootState}, {nodes, color}) {
            return this.dispatch('fetch', {
                route: 'changeColor',
                body: {
                    apikey: rootState.auth.apikey,
                    nodes: nodes.map(v => v.id),
                    newColor: color
                }
            }).then(() => {

                // Override color
                nodes.forEach(n => n.color = color);
            });
        }
    }
};
