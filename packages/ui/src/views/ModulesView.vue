<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api.js'

const modules = ref([])
const values = ref({})
const loading = ref(true)

onMounted(async () => {
  modules.value = await api.listModules()
  for (const module of modules.value) {
    values.value[module.id] = await api.getModuleSettings(module.id)
  }
  loading.value = false
})

async function update(moduleId, schema, value) {
  values.value[moduleId] = { ...values.value[moduleId], [schema.key]: value }
  await api.setModuleSetting(moduleId, schema.key, value)
}

function isOn(moduleId, schema) {
  return Boolean(values.value[moduleId]?.[schema.key])
}
</script>

<template>
  <h2 class="section-title">功能模块 <span class="count">{{ modules.length }} 个</span></h2>
  <p class="section-desc">模块运行在 B 站页面中，设置会持久化到本地存储。</p>

  <div v-if="loading" class="empty">正在读取模块…</div>
  <div v-else-if="!modules.length" class="empty">当前环境没有可用的模块运行时。</div>
  <div v-else class="grid">
    <article v-for="module in modules" :key="module.id" class="card">
      <div class="card-head">
        <h3>{{ module.name }}</h3>
        <button
          v-if="module.settings?.[0]?.type === 'boolean'"
          class="switch"
          :class="{ on: isOn(module.id, module.settings[0]) }"
          @click="update(module.id, module.settings[0], !isOn(module.id, module.settings[0]))"
        ><i></i></button>
      </div>
      <p>{{ module.description }}</p>
      <div class="tag-row"><span class="tag">{{ module.category }}</span><span class="tag">v{{ module.version }}</span></div>

      <div v-for="schema in (module.settings ?? []).filter((item) => item.type !== 'boolean')" :key="schema.key" class="field">
        <div class="field-label"><span>{{ schema.label }}</span><span>{{ values[module.id]?.[schema.key] }}</span></div>
        <input
          v-if="schema.type === 'range'"
          type="range"
          :min="schema.min ?? 0"
          :max="schema.max ?? 1"
          :step="schema.step ?? 0.05"
          :value="values[module.id]?.[schema.key]"
          @input="update(module.id, schema, Number($event.target.value))"
        />
        <input
          v-else-if="schema.type === 'number'"
          type="number"
          :min="schema.min"
          :max="schema.max"
          :value="values[module.id]?.[schema.key]"
          @change="update(module.id, schema, Number($event.target.value))"
        />
        <select
          v-else-if="schema.type === 'select'"
          :value="values[module.id]?.[schema.key]"
          @change="update(module.id, schema, $event.target.value)"
        >
          <option v-for="option in schema.options ?? []" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
        </select>
        <input
          v-else
          type="text"
          :value="values[module.id]?.[schema.key]"
          @change="update(module.id, schema, $event.target.value)"
        />
      </div>
    </article>
  </div>
</template>
