<template>
  <div class="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
    <h2 class="text-2xl font-bold mb-6">Create Live Class</h2>

    <div class="space-y-4">
      <!-- Course Selection -->
      <div>
        <label class="block text-sm font-medium mb-2">Select Course</label>
        <select
          v-model="form.courseId"
          class="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
          @change="onCourseSelected"
        >
          <option value="">-- Choose a course --</option>
          <option v-for="course in courses" :key="course.id" :value="course.id">
            {{ course.icon }} {{ course.title }}
          </option>
        </select>
        <p v-if="selectedCourse" class="text-sm text-gray-500 mt-2">
          Class Code: <span class="font-bold text-blue-600">{{ selectedCourse.code }}</span>
        </p>
      </div>

      <!-- Title -->
      <div>
        <label class="block text-sm font-medium mb-2">Class Title</label>
        <input
          v-model="form.title"
          type="text"
          placeholder="e.g., Week 1 - Introduction"
          class="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
        />
      </div>

      <!-- Description -->
      <div>
        <label class="block text-sm font-medium mb-2">Description (Optional)</label>
        <textarea
          v-model="form.description"
          placeholder="Add details about this live class..."
          rows="3"
          class="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
        ></textarea>
      </div>

      <!-- Scheduled Time -->
      <div>
        <label class="block text-sm font-medium mb-2">Scheduled Time (Optional)</label>
        <input
          v-model="form.scheduledAt"
          type="datetime-local"
          class="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
        />
      </div>

      <!-- Error Message -->
      <div v-if="error" class="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded-lg">
        {{ error }}
      </div>

      <!-- Loading -->
      <div v-if="loading" class="p-4 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 rounded-lg">
        Creating live class...
      </div>

      <!-- Buttons -->
      <div class="flex gap-3">
        <button
          @click="createLiveClass"
          :disabled="loading || !form.courseId || !form.title"
          class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
        >
          {{ loading ? 'Creating...' : 'Create & Start Class' }}
        </button>
        <button
          @click="$emit('close')"
          class="px-6 py-2 bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500 text-gray-800 dark:text-white rounded-lg font-medium transition"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Success Message -->
    <div v-if="successMessage" class="mt-6 p-4 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-100 rounded-lg">
      <p class="font-bold mb-2">✅ Live class created successfully!</p>
      <p class="mb-2">Channel: <span class="font-mono">{{ liveClass?.channel_name }}</span></p>
      <p>Class Code: <span class="font-bold text-blue-600">{{ selectedCourse?.code }}</span></p>
      <button
        @click="joinLiveClass"
        class="mt-3 w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
      >
        Join Live Class Now 🎥
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { courseService } from '../services/courseService'
import { liveClassService } from '../services/liveClassService'

const emit = defineEmits(['close', 'live-class-created'])

const form = ref({
  courseId: '',
  title: '',
  description: '',
  scheduledAt: ''
})

const courses = ref([])
const selectedCourse = ref(null)
const loading = ref(false)
const error = ref('')
const successMessage = ref(false)
const liveClass = ref(null)

// Load courses on mount
onMounted(async () => {
  try {
    const response = await courseService.getCourses()
    if (response.success) {
      courses.value = response.data.courses
    }
  } catch (err) {
    error.value = 'Failed to load courses'
    console.error(err)
  }
})

// When course is selected
const onCourseSelected = () => {
  selectedCourse.value = courses.value.find(c => c.id === form.value.courseId)
}

// Create live class
const createLiveClass = async () => {
  if (!form.value.courseId || !form.value.title) {
    error.value = 'Course and title are required'
    return
  }

  loading.value = true
  error.value = ''
  successMessage.value = false

  try {
    const response = await liveClassService.createLiveClass(
      form.value.courseId,
      form.value.title,
      form.value.description,
      form.value.scheduledAt || new Date().toISOString()
    )

    if (response.success) {
      liveClass.value = response.data.liveClass
      successMessage.value = true
      emit('live-class-created', response.data.liveClass)

      // Optionally start the class immediately
      await startClass()
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to create live class'
    console.error(err)
  } finally {
    loading.value = false
  }
}

// Start the live class
const startClass = async () => {
  try {
    await liveClassService.startLiveClass(liveClass.value.id)
    console.log('Live class started')
  } catch (err) {
    console.error('Failed to start class:', err)
  }
}

// Join the live class
const joinLiveClass = async () => {
  emit('close')
  emit('live-class-created', liveClass.value)
}
</script>