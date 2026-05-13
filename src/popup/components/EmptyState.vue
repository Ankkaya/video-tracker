<script setup lang="ts">
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon">📭</div>
    <div class="empty-title">暂无观看记录</div>
    <div class="empty-desc">
      观看视频超过阈值时间后将自动记录
      <br />
      或使用 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> 手动记录
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 12px;
  color: #888;
  line-height: 1.6;
}

kbd {
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 11px;
  font-family: monospace;
}
</style>
