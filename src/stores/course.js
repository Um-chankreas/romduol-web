import { defineStore } from 'pinia';
import { ref } from 'vue';
import { courseService } from '../api/course.service';

export const useCourseStore = defineStore('course', () => {
    const courses = ref([]);
    const loading = ref(false);
    const error = ref(null);

    async function fetchCourses() {
        loading.value = true;
        error.value = null;
        try {
            const res = await courseService.getCourses();
            if (res.success) {
                courses.value = res.data.courses;
            }
        } catch (err) {
            error.value = err.response?.data?.error || 'Failed to fetch courses';
        } finally {
            loading.value = false;
        }
    }

    return {
        courses,
        loading,
        error,
        fetchCourses
    };
});