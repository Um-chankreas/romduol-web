import { defineStore } from 'pinia';
import { liveClassService } from '@/api/liveClass.service';

export const useLiveClassStore = defineStore('liveClass', {
    state: () => ({
        currentClass: null,
        liveClasses: [],

        loading: false,
        error: null,
    }),

    getters: {
        isLive: (state) => {
            return state.currentClass?.status === 'active';
        },

        participantCount: (state) => {
            return state.currentClass?.participants_count || 0;
        },
    },

    actions: {
        /**
         * Create live class
         */
        async createClass(data) {
            this.loading = true;
            this.error = null;

            try {
                const response =
                    await liveClassService.createLiveClass(data);

                if (!response.success) {
                    throw new Error(
                        response.error || 'Failed to create live class'
                    );
                }

                this.currentClass =
                    response.data.liveClass;

                return response;
            } catch (error) {
                this.error =
                    error.response?.data?.error ||
                    error.message ||
                    'Failed to create live class';

                throw error;
            } finally {
                this.loading = false;
            }
        },

        /**
         * Start live class
         */
        async startClass(id) {
            this.loading = true;
            this.error = null;

            try {
                const response =
                    await liveClassService.startLiveClass(id);

                if (!response.success) {
                    throw new Error(
                        response.error ||
                        'Failed to start live class'
                    );
                }

                this.currentClass =
                    response.data.liveClass;

                return response;
            } catch (error) {
                this.error =
                    error.response?.data?.error ||
                    error.message ||
                    'Failed to start live class';

                throw error;
            } finally {
                this.loading = false;
            }
        },

        /**
         * Get live class details
         */
        async fetchClass(id) {
            this.loading = true;
            this.error = null;

            try {
                const response =
                    await liveClassService.getLiveClassDetails(id);

                if (!response.success) {
                    throw new Error(
                        response.error ||
                        'Failed to fetch live class'
                    );
                }

                this.currentClass =
                    response.data.liveClass;

                return response;
            } catch (error) {
                this.error =
                    error.response?.data?.error ||
                    error.message ||
                    'Failed to fetch live class';

                throw error;
            } finally {
                this.loading = false;
            }
        },

        /**
         * Get course live classes
         */
        async fetchCourseLiveClasses(courseId) {
            this.loading = true;
            this.error = null;

            try {
                const response =
                    await liveClassService.getCourseLiveClasses(
                        courseId
                    );

                if (!response.success) {
                    throw new Error(
                        response.error ||
                        'Failed to fetch live classes'
                    );
                }

                this.liveClasses =
                    response.data.liveClasses || [];

                return response;
            } catch (error) {
                this.error =
                    error.response?.data?.error ||
                    error.message ||
                    'Failed to fetch live classes';

                throw error;
            } finally {
                this.loading = false;
            }
        },

        /**
         * Get Agora credentials
         */
        async getAgoraCredentials(id, uid) {
            try {
                const response =
                    await liveClassService.getAgoraToken(
                        id,
                        uid
                    );

                if (!response.success) {
                    throw new Error(
                        response.error ||
                        'Failed to get Agora token'
                    );
                }

                return response;
            } catch (error) {
                this.error =
                    error.response?.data?.error ||
                    error.message ||
                    'Failed to get Agora credentials';

                throw error;
            }
        },

        /**
         * End live class
         */
        async endClass(id) {
            this.loading = true;
            this.error = null;

            try {
                const response =
                    await liveClassService.endLiveClass(id);

                if (!response.success) {
                    throw new Error(
                        response.error ||
                        'Failed to end live class'
                    );
                }

                this.currentClass =
                    response.data.liveClass;

                return response;
            } catch (error) {
                this.error =
                    error.response?.data?.error ||
                    error.message ||
                    'Failed to end live class';

                throw error;
            } finally {
                this.loading = false;
            }
        },

        /**
         * Leave live class
         */
        async leaveClass(id) {
            try {
                return await liveClassService.leaveLiveClass(id);
            } catch (error) {
                console.error(
                    'Failed to leave live class:',
                    error
                );

                throw error;
            }
        },

        /**
         * Clear current class
         */
        clearCurrentClass() {
            this.currentClass = null;
        },
    },
});