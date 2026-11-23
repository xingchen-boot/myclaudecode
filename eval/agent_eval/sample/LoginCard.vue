<template>
  <div class="card" :class="isActive && 'card--active'">
    <p class="title">登录</p>
    <p class="desc">请使用 QQ 账号登录</p>
  </div>
</template>

<style scoped>
.card {
  margin: 12px;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 16px;
  background: #ffffff;
}
.card--active {
  background: #f3f6ff;
}
.title {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #1f3a5f;
}
.desc {
  font-size: 12px;
  color: #666666;
}
</style>
