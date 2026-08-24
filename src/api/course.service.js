import api from './axios';

export const courseService = {
    // GET /api/courses
    async getCourses() {
        const response = await api.get('/courses');
        return response.data;
    },

    // POST /api/courses
    async createCourse(courseData) {
        const response = await api.post('/courses', courseData);
        return response.data;
    }
};