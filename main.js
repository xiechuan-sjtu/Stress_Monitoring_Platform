document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".nav-button");
  const viewContainer = document.getElementById("view-container");

  // 实时应力柱状图的定时器与数据缓存
  let realtimeTimer = null;
  let realtimeSeries = null; // { timeLabels: string[], values: number[][] }
  let realtimeIndex = 0;
  let realtimeSelectedChannel = 1; // 当前高亮的通道编号（1~16）
  // 实时应力柱状图 Y 轴全局范围（根据整段时间数据一次性计算，避免每一帧刻度变化）
  let realtimeYUpper = null;
  let realtimeYLower = null;

  function renderSensorView() {
    if (!viewContainer) return;

    viewContainer.innerHTML = `
      <div class="sensor-top-text">
        应力监测平台是持续监测风帆在风载荷下的受力情况，<br />
        以便验证风帆的安全可靠性能，助力风帆助推系统的优化提升。
      </div>
      <section class="sensor-view">
        <div class="sensor-media">
          <div class="sensor-image-wrapper">
            <img src="风帆实拍图.jpg" alt="风帆实拍图" class="sensor-image" />
            <div class="sensor-caption">风帆实拍图</div>
          </div>
          <div class="sensor-image-wrapper sensor-topview-wrapper">
            <img src="俯视图.png" alt="风帆俯视图" class="sensor-image" />
            <div class="sensor-caption">风帆俯视图</div>
          </div>
        </div>
      </section>
    `;
  }

  function renderRealtimeView() {
    if (!viewContainer) return;

    viewContainer.innerHTML = `
      <section class="realtime-view">
        <button id="sensor-location-button" class="sensor-location-button">
          传感器位置
        </button>
        <div class="channel-buttons">
          <div class="channel-row">
            <button class="channel-button">1通道</button>
            <button class="channel-button">2通道</button>
            <button class="channel-button">3通道</button>
            <button class="channel-button">4通道</button>
            <button class="channel-button">5通道</button>
            <button class="channel-button">6通道</button>
            <button class="channel-button">7通道</button>
            <button class="channel-button">8通道</button>
          </div>
          <div class="channel-row">
            <button class="channel-button">9通道</button>
            <button class="channel-button">10通道</button>
            <button class="channel-button">11通道</button>
            <button class="channel-button">12通道</button>
            <button class="channel-button">13通道</button>
            <button class="channel-button">14通道</button>
            <button class="channel-button">15通道</button>
            <button class="channel-button">16通道</button>
          </div>
        </div>

        <div class="realtime-chart-wrapper">
          <div class="realtime-chart-header">
            <div class="realtime-chart-title">实时应力柱状图</div>
            <div class="stress-alarm-indicator">
              <span
                id="stress-alarm-lamp"
                class="stress-alarm-lamp stress-alarm-ok"
              ></span>
              <span id="stress-alarm-text" class="stress-alarm-text">
                应力警报
              </span>
            </div>
          </div>
          <div id="realtime-chart" class="realtime-chart"></div>
          <div class="realtime-chart-footer">
            <span id="realtime-time-label">时间：--</span>
            <span id="realtime-value-label">当前通道应力：-- MPa</span>
          </div>
        </div>

        <div id="sensor-location-panel" class="sensor-location-panel">
          <img
            src="俯视图.png"
            alt="传感器位置俯视图"
            class="sensor-location-image"
          />
        </div>
      </section>
    `;

    // 绑定“实时应力”页面上的通道按钮：点击后高亮对应柱子，并显示该通道实时数值
    const rtChannelButtons = viewContainer.querySelectorAll(".channel-button");
    realtimeSelectedChannel = 1;
    rtChannelButtons.forEach((btn, idx) => {
      const channelIndex = idx + 1; // 1~16
      if (channelIndex === realtimeSelectedChannel) {
        btn.classList.add("channel-button-active");
      }

      btn.addEventListener("click", () => {
        realtimeSelectedChannel = channelIndex;

        // 按钮高亮
        rtChannelButtons.forEach((b) =>
          b.classList.remove("channel-button-active")
        );
        btn.classList.add("channel-button-active");

        // 如果已有实时数据，立即刷新当前帧，让对应柱子变亮并更新数值
        const chartContainer = document.getElementById("realtime-chart");
        const valueLabelEl = document.getElementById("realtime-value-label");
        if (
          chartContainer &&
          realtimeSeries &&
          realtimeSeries.values.length > 0
        ) {
          const values = realtimeSeries.values[realtimeIndex];
          const timeLabel = realtimeSeries.timeLabels[realtimeIndex];
          renderRealtimeBars(chartContainer, values, timeLabel);

          const chIdx = Math.min(
            Math.max(realtimeSelectedChannel, 1),
            values.length
          );
          const v = values[chIdx - 1];
          if (valueLabelEl) {
            valueLabelEl.textContent = `当前通道（${chIdx}）应力：${v.toFixed(
              2
            )} MPa`;
          }
        }
      });
    });

    // “传感器位置”按钮与右侧弹出俯视图
    const sensorBtn = document.getElementById("sensor-location-button");
    const sensorPanel = document.getElementById("sensor-location-panel");
    if (sensorBtn && sensorPanel) {
      // 鼠标移到按钮上，面板从右侧滑出
      sensorBtn.addEventListener("mouseenter", () => {
        sensorPanel.classList.add("open");
      });

      // 鼠标离开按钮后，面板缩回
      sensorBtn.addEventListener("mouseleave", () => {
        sensorPanel.classList.remove("open");
      });
    }

    startRealtimeChart();
  }

  function renderTrendView() {
    if (!viewContainer) return;

    viewContainer.innerHTML = `
      <section class="realtime-view">
        <button id="sensor-location-button" class="sensor-location-button">
          传感器位置
        </button>
        <div class="channel-buttons">
          <div class="channel-row">
            <button class="channel-button">1通道（T）</button>
            <button class="channel-button">2通道</button>
            <button class="channel-button">3通道</button>
            <button class="channel-button">4通道（T）</button>
            <button class="channel-button">5通道</button>
            <button class="channel-button">6通道（T）</button>
            <button class="channel-button">7通道</button>
            <button class="channel-button">8通道（T）</button>
          </div>
          <div class="channel-row">
            <button class="channel-button">9通道</button>
            <button class="channel-button">10通道（T）</button>
            <button class="channel-button">11通道</button>
            <button class="channel-button">12通道（T）</button>
            <button class="channel-button">13通道（T）</button>
            <button class="channel-button">14通道</button>
            <button class="channel-button">15通道</button>
            <button class="channel-button">16通道</button>
          </div>
        </div>
        <div class="trend-chart-wrapper">
          <div class="trend-controls">
            <div class="trend-chart-title">1通道等效应力随时间变化</div>
            <select class="trend-range-select">
              <option value="1h">过去1小时</option>
              <option value="24h">过去24小时</option>
              <option value="2d">过去2天</option>
              <option value="5d">过去5天</option>
              <option value="10d">过去10天</option>
              <option value="20d">过去20天</option>
              <option value="1m">过去30天</option>
            </select>
          </div>
          <div id="trend-chart" class="trend-chart"></div>
        </div>

        <div id="sensor-location-panel" class="sensor-location-panel">
          <img
            src="俯视图.png"
            alt="传感器位置俯视图"
            class="sensor-location-image"
          />
        </div>
      </section>
    `;

    // 绑定通道按钮点击事件，切换不同通道的曲线
    const channelButtons = viewContainer.querySelectorAll(".channel-button");
    channelButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const label = btn.textContent.trim();
        const match = label.match(/^(\d+)/); // 提取前面的数字，例如“1通道”
        if (!match) return;
        const channelIndex = parseInt(match[1], 10);
        if (Number.isNaN(channelIndex)) return;

        console.log("切换到应力趋势通道：", channelIndex);

        // 高亮当前通道按钮
        channelButtons.forEach((b) =>
          b.classList.remove("channel-button-active")
        );
        btn.classList.add("channel-button-active");

        // 重新加载对应通道的数据
        loadTrendData(channelIndex);
      });
    });

    // 默认选中 1 通道
    if (channelButtons[0]) {
      channelButtons[0].classList.add("channel-button-active");
    }
    loadTrendData(1);

    // “传感器位置”按钮与右侧弹出俯视图（与实时应力页面一致）
    const sensorBtn = document.getElementById("sensor-location-button");
    const sensorPanel = document.getElementById("sensor-location-panel");
    if (sensorBtn && sensorPanel) {
      // 鼠标移到按钮上，面板从右侧滑出
      sensorBtn.addEventListener("mouseenter", () => {
        sensorPanel.classList.add("open");
      });

      // 鼠标离开按钮后，面板缩回
      sensorBtn.addEventListener("mouseleave", () => {
        sensorPanel.classList.remove("open");
      });
    }
  }

  /**
   * 启动实时应力柱状图：读取 CSV 并开启定时刷新
   */
  function startRealtimeChart() {
    const chartContainer = document.getElementById("realtime-chart");
    const timeLabelEl = document.getElementById("realtime-time-label");
    if (!chartContainer || !timeLabelEl) return;

    // 如果已有数据，直接从当前索引开始播放
    if (realtimeSeries && realtimeSeries.timeLabels.length > 0) {
      runRealtimeAnimation(chartContainer, timeLabelEl);
      return;
    }

    chartContainer.textContent = "实时应力数据加载中...";

    fetch("Sigma_eq_TimeSeries.csv")
      .then((res) => res.text())
      .then((text) => {
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          chartContainer.textContent = "未读取到有效实时数据（CSV 内容为空）";
          return;
        }

        const timeLabels = [];
        const values = [];
        let globalMin = Infinity;
        let globalMax = -Infinity;

        // 跳过表头，从第 2 行开始读取：第 1 列为时间，其后 16 列依次为 1~16 通道
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",");
          if (cols.length < 2) continue;

          const tLabel = cols[0].trim();
          const rowVals = [];
          for (let c = 1; c <= 16; c++) {
            const raw = cols[c];
            const v = parseFloat(raw ?? "NaN");
            const safeV = Number.isNaN(v) ? 0 : v;
            rowVals.push(safeV);

            if (!Number.isNaN(v)) {
              if (v < globalMin) globalMin = v;
              if (v > globalMax) globalMax = v;
            }
          }

          timeLabels.push(tLabel);
          values.push(rowVals);
        }

        if (timeLabels.length === 0) {
          chartContainer.textContent = "未读取到有效实时数据（各通道列均非数值）";
          return;
        }

        // 计算整段时间上的统一 Y 轴范围，后续每一帧都使用该范围，保证刻度固定不跳动
        if (globalMax === -Infinity || globalMin === Infinity) {
          realtimeYUpper = 1;
          realtimeYLower = 0;
        } else {
          realtimeYUpper = globalMax <= 0 ? 1 : globalMax * 1.1;
          realtimeYLower = globalMin >= 0 ? 0 : globalMin * 1.1;
        }

        realtimeSeries = { timeLabels, values };
        realtimeIndex = 0;
        runRealtimeAnimation(chartContainer, timeLabelEl);
      })
      .catch((err) => {
        console.error("读取实时应力 CSV 失败:", err);
        chartContainer.textContent =
          "读取实时应力数据失败，请检查 Sigma_eq_TimeSeries.csv 是否存在且可访问。";
      });
  }

  /**
   * 停止实时应力柱状图动画
   */
  function stopRealtimeChart() {
    if (realtimeTimer) {
      clearInterval(realtimeTimer);
      realtimeTimer = null;
    }
  }

  /**
   * 根据缓存数据运行实时动画
   */
  function runRealtimeAnimation(chartContainer, timeLabelEl) {
    if (!realtimeSeries || realtimeSeries.timeLabels.length === 0) return;

    const valueLabelEl = document.getElementById("realtime-value-label");

    // 先画一次
    const initialValues = realtimeSeries.values[realtimeIndex];
    const initialTime = realtimeSeries.timeLabels[realtimeIndex];
    renderRealtimeBars(chartContainer, initialValues, initialTime);
    timeLabelEl.textContent = `时间：${initialTime}`;

    if (valueLabelEl) {
      const chIdx = Math.min(
        Math.max(realtimeSelectedChannel, 1),
        initialValues.length
      );
      const v = initialValues[chIdx - 1];
      valueLabelEl.textContent = `当前通道（${chIdx}）应力：${v.toFixed(
        2
      )} MPa`;
    }

    // 清理旧定时器
    stopRealtimeChart();

    // 每 500ms 切换一个时间点
    realtimeTimer = setInterval(() => {
      if (!realtimeSeries || realtimeSeries.timeLabels.length === 0) return;

      realtimeIndex =
        (realtimeIndex + 1) % realtimeSeries.timeLabels.length;

      const values = realtimeSeries.values[realtimeIndex];
      const timeLabel = realtimeSeries.timeLabels[realtimeIndex];

      renderRealtimeBars(chartContainer, values, timeLabel);
      timeLabelEl.textContent = `时间：${timeLabel}`;

      if (valueLabelEl) {
        const chIdx = Math.min(
          Math.max(realtimeSelectedChannel, 1),
          values.length
        );
        const v = values[chIdx - 1];
        valueLabelEl.textContent = `当前通道（${chIdx}）应力：${v.toFixed(
          2
        )} MPa`;
      }
    }, 500);
  }

  /**
   * 在实时应力页面绘制单帧 16 通道柱状图
   * @param {HTMLElement} container
   * @param {number[]} values  长度为 16 的通道应力数组
   * @param {string} timeLabel 当前时间刻度字符串
   */
  function renderRealtimeBars(container, values, timeLabel) {
    const width = 820;
    const height = 260;
    const paddingLeft = 56; // 左侧留更大空白，避免遮住 Y 轴标题
    const paddingRight = 20;
    const paddingTop = 24;
    const paddingBottom = 40;

    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);

    // 若已根据整段时间数据计算出全局 Y 轴范围，则优先使用全局范围，使刻度固定不变
    const upper =
      typeof realtimeYUpper === "number"
        ? realtimeYUpper
        : maxVal <= 0
        ? 1
        : maxVal * 1.1;
    const lower =
      typeof realtimeYLower === "number"
        ? realtimeYLower
        : minVal >= 0
        ? 0
        : minVal * 1.1;
    const range = upper - lower || 1;

    const usableWidth = width - paddingLeft - paddingRight;
    const usableHeight = height - paddingTop - paddingBottom;

    const barCount = values.length;
    const barGap = 4;
    const barWidth = Math.max(
      6,
      (usableWidth - barGap * (barCount - 1)) / barCount
    );

    // 报警阈值与指示灯：任一通道超过阈值则报警
    const alarmThreshold = 201;
    const hasAlarm = values.some((v) => v > alarmThreshold);

    const alarmLamp = document.getElementById("stress-alarm-lamp");
    if (alarmLamp) {
      alarmLamp.classList.remove("stress-alarm-ok", "stress-alarm-alert");
      alarmLamp.classList.add(hasAlarm ? "stress-alarm-alert" : "stress-alarm-ok");
    }

    // 生成 Y 轴多级刻度文本（上到下若干个等分）
    const yTickCount = 4; // 生成 5 个刻度（含上下边界）
    const yTicks = [];
    for (let i = 0; i <= yTickCount; i++) {
      const frac = i / yTickCount; // 0 顶部，1 底部
      const val = upper - frac * range;
      const y = paddingTop + frac * usableHeight;
      yTicks.push(`
        <text
          x="${paddingLeft - 8}"
          y="${y + 4}"
          text-anchor="end"
          font-size="10"
          fill="#cfd9ff"
        >
          ${val.toFixed(1)}
        </text>
      `);
    }

    const activeValueLabels = [];
    const bars = values
      .map((v, i) => {
        const x = paddingLeft + i * (barWidth + barGap);
        const ratio = (v - lower) / range;
        const barHeight = ratio * usableHeight;
        const y = paddingTop + (usableHeight - barHeight);

        const isActive = i + 1 === realtimeSelectedChannel;
        const isAlarm = v > alarmThreshold;

        let fill;
        let stroke;
        let strokeWidth;

        if (isAlarm) {
          // 超过阈值的柱子：红色系，高亮更明显
          fill = isActive ? "#ff5c5c" : "#ff4d4f";
          stroke = isActive ? "#ffd0d0" : "#ffb3b3";
          strokeWidth = 1.4;
        } else {
          // 正常范围：沿用原有蓝色 / 黄色样式
          fill = isActive ? "#ffd764" : "#42d3ff";
          stroke = isActive ? "#ffe9a6" : "none";
          strokeWidth = isActive ? 1.2 : 0;
        }

        if (isActive) {
          activeValueLabels.push(`
            <text
              x="${x + barWidth / 2}"
              y="${y - 6}"
              text-anchor="middle"
              font-size="10"
              fill="#ffeec0"
            >
              ${v.toFixed(2)}
            </text>
          `);
        }

        return `<rect
          x="${x}"
          y="${y}"
          width="${barWidth}"
          height="${barHeight}"
          rx="3"
          ry="3"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="${strokeWidth}"
        />`;
      })
      .join("");

    const channelLabels = values
      .map(
        (_v, i) => `
        <text
          x="${paddingLeft + i * (barWidth + barGap) + barWidth / 2}"
          y="${height - paddingBottom + 14}"
          text-anchor="middle"
          font-size="9"
          fill="#cfd9ff"
        >
          ${i + 1}
        </text>`
      )
      .join("");

    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <!-- 背景网格 -->
        <defs>
          <pattern id="realtime-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(120,140,180,0.16)" stroke-width="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#realtime-grid)" />

        <!-- 坐标轴 -->
        <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" stroke="#9fb4ff" stroke-width="1" />
        <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="#9fb4ff" stroke-width="1" />

        <!-- Y 轴刻度（上到下多级数值） -->
        ${yTicks.join("")}

        <!-- 轴标题 -->
        <text
          x="14"
          y="${(height - paddingBottom + paddingTop) / 2}"
          text-anchor="middle"
          font-size="11"
          fill="#e2ebff"
          transform="rotate(-90 14 ${(height - paddingBottom + paddingTop) / 2})"
        >
          等效应力（MPa）
        </text>
        <text
          x="${(paddingLeft + width - paddingRight) / 2}"
          y="${height - 8}"
          text-anchor="middle"
          font-size="11"
          fill="#e2ebff"
        >
          通道编号
        </text>

        <!-- 当前时间显示 -->
        <text
          x="${width - paddingRight}"
          y="${paddingTop + 4}"
          text-anchor="end"
          font-size="16"
          fill="#e2ebff"
        >
          ${timeLabel}
        </text>

        <!-- 柱状图 -->
        ${bars}

        <!-- 选中柱子的顶部数值 -->
        ${activeValueLabels.join("")}

        <!-- X 轴通道标签 -->
        ${channelLabels}
      </svg>
    `;

    container.innerHTML = svg;
  }

  /**
   * 从 CSV 文件中读取指定通道（列）的数据并绘图
   * 第 1 列作为所有通道的 X 轴时间刻度（按字符串原样显示），
   * 从第 2 列起依次对应 1 通道、2 通道...
   * @param {number} channelIndex 通道编号（1~16）
   */
  function loadTrendData(channelIndex = 1) {
    const chartContainer = document.getElementById("trend-chart");
    if (!chartContainer) return;

    // 先给出加载中的提示
    chartContainer.textContent = "曲线数据加载中...";

    // 更新标题
    const titleEl = document.querySelector(".trend-chart-title");
    if (titleEl) {
      titleEl.textContent = `${channelIndex}通道`;
    }

    // 仅 1、4、6、8、10、12、13 通道叠加温度数据，其他通道只显示应力曲线
    if (
      channelIndex === 1 ||
      channelIndex === 4 ||
      channelIndex === 6 ||
      channelIndex === 8 ||
      channelIndex === 10 ||
      channelIndex === 12 ||
      channelIndex === 13
    ) {
      Promise.all([
        fetch("Sigma_eq_TimeSeries.csv").then((res) => res.text()),
        fetch("Temperature_TimeSeries.csv").then((res) => res.text()),
      ])
        .then(([stressText, tempText]) => {
          // 解析应力数据
          const stressLines = stressText
            .split(/\r?\n/)
            .filter((l) => l.trim().length > 0);
          if (stressLines.length <= 1) {
            chartContainer.textContent =
              "未读取到有效应力数据（CSV 内容为空）";
            return;
          }

          // 跳过表头，从第二行开始取时间列（字符串）和指定通道列的数据：
          // 第 1 列为时间字符串，从第 2 列起依次对应 1 通道、2 通道...
          const sampleCols = stressLines[1].split(",");
          const maxColIndex = Math.max(1, sampleCols.length - 1); // 至少为 1，避免越界
          const colIndex = Math.min(channelIndex, maxColIndex); // 1 通道 -> 第 2 列（索引 1），以此类推

          const timeLabels = [];
          const stressData = [];
          for (let i = 1; i < stressLines.length; i++) {
            const cols = stressLines[i].split(",");
            if (cols.length <= colIndex) continue;

            const tLabel = cols[0].trim(); // 第 1 列时间（字符串）
            const v = parseFloat(cols[colIndex]); // 对应通道值
            if (Number.isNaN(v)) continue;

            timeLabels.push(tLabel);
            stressData.push(v);
          }

          if (stressData.length === 0) {
            chartContainer.textContent =
              "未读取到有效应力数据（当前通道对应列均非数值）";
            return;
          }

          // 解析温度数据：
          // - 1 通道：取 Temperature_TimeSeries.csv 的第 2 列（索引 1）
          // - 4 通道：取 Temperature_TimeSeries.csv 的第 3 列（索引 2）
          // - 6 通道：取 Temperature_TimeSeries.csv 的第 4 列（索引 3）
          // - 8 通道：取 Temperature_TimeSeries.csv 的第 5 列（索引 4）
          // - 10 通道：取 Temperature_TimeSeries.csv 的第 6 列（索引 5）
          // - 12 通道：取 Temperature_TimeSeries.csv 的第 7 列（索引 6）
          // - 13 通道：取 Temperature_TimeSeries.csv 的第 8 列（索引 7）
          const tempColIndex =
            channelIndex === 1
              ? 1
              : channelIndex === 4
              ? 2
              : channelIndex === 6
              ? 3
              : channelIndex === 8
              ? 4
              : channelIndex === 10
              ? 5
              : channelIndex === 12
              ? 6
              : 7;
          const tempLines = tempText
            .split(/\r?\n/)
            .filter((l) => l.trim().length > 0);
          const tempData = [];
          if (tempLines.length > 1) {
            for (let i = 1; i < tempLines.length; i++) {
              const cols = tempLines[i].split(",");
              if (cols.length <= tempColIndex) continue;
              const vt = parseFloat(cols[tempColIndex]);
              if (Number.isNaN(vt)) continue;
              tempData.push(vt);
            }
          }

          // 对齐长度：按较短长度裁剪
          const len = Math.min(stressData.length, tempData.length || Infinity);
          const finalStress = stressData.slice(0, len);
          const finalTime = timeLabels.slice(0, len);
          const finalTemp =
            tempData.length > 0 ? tempData.slice(0, len) : undefined;

          console.log(
            `应力趋势通道 ${channelIndex} 数据点数量（带温度）：`,
            finalStress.length
          );
          renderLineChart(chartContainer, finalTime, finalStress, finalTemp);
        })
        .catch((err) => {
          console.error("读取趋势 CSV 失败:", err);
          chartContainer.textContent =
            "读取 CSV 失败，请确认相关 CSV 文件与 index.html 位于同一目录，并通过 http 方式打开页面。";
        });
    } else {
      // 其他通道仅加载应力 CSV
      fetch("Sigma_eq_TimeSeries.csv")
        .then((res) => res.text())
        .then((stressText) => {
          const stressLines = stressText
            .split(/\r?\n/)
            .filter((l) => l.trim().length > 0);
          if (stressLines.length <= 1) {
            chartContainer.textContent =
              "未读取到有效应力数据（CSV 内容为空）";
            return;
          }

          const sampleCols = stressLines[1].split(",");
          const maxColIndex = Math.max(1, sampleCols.length - 1);
          const colIndex = Math.min(channelIndex, maxColIndex);

          const timeLabels = [];
          const stressData = [];
          for (let i = 1; i < stressLines.length; i++) {
            const cols = stressLines[i].split(",");
            if (cols.length <= colIndex) continue;

            const tLabel = cols[0].trim();
            const v = parseFloat(cols[colIndex]);
            if (Number.isNaN(v)) continue;

            timeLabels.push(tLabel);
            stressData.push(v);
          }

          if (stressData.length === 0) {
            chartContainer.textContent =
              "未读取到有效应力数据（当前通道对应列均非数值）";
            return;
          }

          console.log(
            `应力趋势通道 ${channelIndex} 数据点数量（仅应力）：`,
            stressData.length
          );
          // 不传温度数据 => 只有左侧应力 Y 轴和一条折线
          renderLineChart(chartContainer, timeLabels, stressData, undefined);
        })
        .catch((err) => {
          console.error("读取 Sigma_eq_TimeSeries.csv 失败:", err);
          chartContainer.textContent =
            "读取 CSV 失败，请确认 Sigma_eq_TimeSeries.csv 与 index.html 位于同一目录，并通过 http 方式打开页面。";
        });
    }
  }

  /**
   * 使用 SVG 在容器中绘制简单折线图
   * @param {HTMLElement} container
   * @param {string[]} timeLabels 时间轴标签（来自 CSV 第 1 列原始字符串）
   * @param {number[]} valueData 通道对应的应力数据
   * @param {number[] | undefined} tempData 温度数据（来自 Temperature_TimeSeries.csv 第 2 列）
   */
  function renderLineChart(container, timeLabels, valueData, tempData) {
    const width = 900; // 加长折线图区域，给右侧 Y 轴留出更多空间
    const height = 260;
    const paddingLeft = 56; // 左侧留更大空白，避免遮住 Y 轴标题
    const paddingRight = 70; // 右侧继续加大留白，确保右侧 Y 轴刻度和标题完全可见
    const paddingTop = 20;
    const paddingBottom = 30;

    // 左侧 Y 轴：应力数据范围
    const stressMax = Math.max(...valueData);
    const stressMin = Math.min(...valueData);
    const stressRange = stressMax - stressMin || 1; // 避免除以 0

    // 右侧 Y 轴：温度数据范围（如果存在）
    let tempMax = 0;
    let tempMin = 0;
    let tempRange = 1;
    const hasTemp = Array.isArray(tempData) && tempData.length > 0;
    if (hasTemp) {
      tempMax = Math.max(...tempData);
      tempMin = Math.min(...tempData);
      tempRange = tempMax - tempMin || 1;
    }

    const usableWidth = width - paddingLeft - paddingRight;
    const usableHeight = height - paddingTop - paddingBottom;

    const stepX =
      valueData.length > 1 ? usableWidth / (valueData.length - 1) : 0;

    const pointsStress = valueData
      .map((v, i) => {
        const x = paddingLeft + i * stepX;
        const y =
          paddingTop + (1 - (v - stressMin) / stressRange) * usableHeight;
        return `${x},${y}`;
      })
      .join(" ");

    // 温度折线点（右侧 Y 轴），如果有温度数据
    const pointsTemp =
      hasTemp && tempData
        ? tempData
            .map((v, i) => {
              const x = paddingLeft + i * stepX;
              const y =
                paddingTop + (1 - (v - tempMin) / tempRange) * usableHeight;
              return `${x},${y}`;
            })
            .join(" ")
        : "";

    // 生成左侧 Y 轴多级刻度（应力）
    const yTickCount = 4; // 生成 5 个刻度（含上下边界）
    const yTicksLeft = [];
    for (let i = 0; i <= yTickCount; i++) {
      const frac = i / yTickCount; // 0 顶部，1 底部
      const val = stressMax - frac * stressRange;
      const y = paddingTop + frac * usableHeight;
      yTicksLeft.push(`
        <text
          x="${paddingLeft - 8}"
          y="${y + 4}"
          text-anchor="end"
          font-size="10"
          fill="#cfd9ff"
        >
          ${val.toFixed(1)}
        </text>
      `);
    }

    // 生成右侧 Y 轴多级刻度（温度）
    const yTicksRight = [];
    if (hasTemp) {
      for (let i = 0; i <= yTickCount; i++) {
        const frac = i / yTickCount;
        const val = tempMax - frac * tempRange;
        const y = paddingTop + frac * usableHeight;
        yTicksRight.push(`
        <text
          x="${width - paddingRight + 8}"
          y="${y + 4}"
          text-anchor="start"
          font-size="10"
          fill="#ffd9a0"
        >
          ${val.toFixed(1)}
        </text>
      `);
      }
    }
    const xMin = timeLabels[0] || "";
    const xMax = timeLabels[timeLabels.length - 1] || "";

    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <!-- 背景网格 -->
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(120,140,180,0.18)" stroke-width="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#grid)" />

        <!-- 坐标轴 -->
        <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" stroke="#9fb4ff" stroke-width="1" />
        <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="#9fb4ff" stroke-width="1" />
        ${
          hasTemp
            ? `<line x1="${width - paddingRight}" y1="${paddingTop}" x2="${
                width - paddingRight
              }" y2="${
                height - paddingBottom
              }" stroke="#ffcf80" stroke-width="1" />`
            : ""
        }

        <!-- 左侧 Y 轴刻度文字（应力，多级数值） -->
        ${yTicksLeft.join("")}

        <!-- 右侧 Y 轴刻度文字（温度，多级数值） -->
        ${yTicksRight.join("")}

        <!-- 轴标题 -->
        <text
          x="14"
          y="${(height - paddingBottom + paddingTop) / 2}"
          text-anchor="middle"
          font-size="11"
          fill="#e2ebff"
          transform="rotate(-90 14 ${(height - paddingBottom + paddingTop) / 2})"
        >
          等效应力（MPa）
        </text>
        ${
          hasTemp
            ? `
        <text
          x="${width - 14}"
          y="${(height - paddingBottom + paddingTop) / 2}"
          text-anchor="middle"
          font-size="11"
          fill="#ffe4b3"
          transform="rotate(-90 ${width - 14} ${
                (height - paddingBottom + paddingTop) / 2
              })"
        >
          温度（℃）
        </text>`
            : ""
        }
        <text
          x="${(paddingLeft + width - paddingRight) / 2}"
          y="${height - 6}"
          text-anchor="middle"
          font-size="11"
          fill="#e2ebff"
        >
          时间
        </text>

        <!-- X 轴两端刻度（真实时间） -->
        <text
          x="${paddingLeft}"
          y="${height - paddingBottom + 16}"
          text-anchor="start"
          font-size="10"
          fill="#cfd9ff"
        >
          ${xMin}
        </text>
        <text
          x="${width - paddingRight}"
          y="${height - paddingBottom + 16}"
          text-anchor="end"
          font-size="10"
          fill="#cfd9ff"
        >
          ${xMax}
        </text>

        <!-- 应力折线（左侧 Y 轴） -->
        <polyline
          fill="none"
          stroke="#4ad2ff"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
          points="${pointsStress}"
        />

        ${
          hasTemp && pointsTemp
            ? `
        <!-- 温度折线（右侧 Y 轴） -->
        <polyline
          fill="none"
          stroke="#ffcf80"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
          points="${pointsTemp}"
        />`
            : ""
        }

        <!-- 鼠标悬停指示线和圆点（初始隐藏） -->
        <line
          id="trend-marker-line"
          x1="${paddingLeft}"
          y1="${paddingTop}"
          x2="${paddingLeft}"
          y2="${height - paddingBottom}"
          stroke="#ffe27a"
          stroke-width="1.2"
          stroke-dasharray="4 3"
          style="display: none;"
        />
        <circle
          id="trend-marker-circle"
          cx="${paddingLeft}"
          cy="${paddingTop}"
          r="4"
          fill="#ffe27a"
          stroke="#1a2238"
          stroke-width="1.4"
          style="display: none;"
        />
      </svg>
    `;

    container.innerHTML = svg;

    // 鼠标滑动时显示时间点与数值
    const svgEl = container.querySelector("svg");
    const markerLine = svgEl?.querySelector("#trend-marker-line");
    const markerCircle = svgEl?.querySelector("#trend-marker-circle");
    if (!svgEl || !markerLine || !markerCircle) return;

    let tooltip = container.querySelector(".trend-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "trend-tooltip";
      container.appendChild(tooltip);
    }

    const showTooltip = (e) => {
      const rect = svgEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      let mouseX = e.clientX - rect.left;

      const plotLeft = paddingLeft;
      const plotRight = width - paddingRight;

      if (mouseX < plotLeft) mouseX = plotLeft;
      if (mouseX > plotRight) mouseX = plotRight;

      const ratio =
        valueData.length > 1
          ? (mouseX - plotLeft) / (plotRight - plotLeft)
          : 0;
      let index = Math.round(ratio * (valueData.length - 1));
      if (index < 0) index = 0;
      if (index > valueData.length - 1) index = valueData.length - 1;

      const value = valueData[index];
      const tempValue =
        hasTemp && tempData && index < tempData.length
          ? tempData[index]
          : undefined;
      const timeLabel = timeLabels[index] ?? "";
      const x =
        paddingLeft +
        (valueData.length > 1
          ? (index * (plotRight - plotLeft)) / (valueData.length - 1)
          : 0);
      const y =
        paddingTop +
        (1 - (value - stressMin) / stressRange) * usableHeight;

      markerLine.setAttribute("x1", String(x));
      markerLine.setAttribute("x2", String(x));
      markerLine.style.display = "block";

      markerCircle.setAttribute("cx", String(x));
      markerCircle.setAttribute("cy", String(y));
      markerCircle.style.display = "block";

      let tip = `时间：${timeLabel}，应力：${value.toFixed(2)} MPa`;
      if (typeof tempValue === "number") {
        tip += `，温度：${tempValue.toFixed(2)} ℃`;
      }
      tooltip.textContent = tip;
      tooltip.style.opacity = "1";
      const offsetX = 14;
      const offsetY = -28;
      tooltip.style.left = `${e.clientX - containerRect.left + offsetX}px`;
      tooltip.style.top = `${e.clientY - containerRect.top + offsetY}px`;
    };

    const hideTooltip = () => {
      markerLine.style.display = "none";
      markerCircle.style.display = "none";
      tooltip.style.opacity = "0";
    };

    svgEl.addEventListener("mousemove", showTooltip);
    svgEl.addEventListener("mouseleave", hideTooltip);
  }

  /**
   * 推力反演页面（暂时为空白占位）
   */
  function renderThrustInverseView() {
    if (!viewContainer) return;

    viewContainer.innerHTML = `
      <section class="realtime-view">
        <div class="trend-chart-wrapper">
          <div class="trend-chart-title">推力反演</div>
          <div class="trend-chart" style="display: flex; align-items: center; justify-content: center; height: 220px;">
            <span style="color: #cfd9ff; opacity: 0.8; font-size: 14px;">
              推力反演页面内容待添加…
            </span>
          </div>
        </div>
      </section>
    `;
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // 切换按钮高亮状态
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const label = btn.textContent.trim();

      // 切换页面前先停止实时动画
      stopRealtimeChart();

      if (label === "应力传感器") {
        renderSensorView();
      } else if (label === "实时应力") {
        renderRealtimeView();
      } else if (label === "应力趋势") {
        renderTrendView();
      } else if (label === "推力反演") {
        renderThrustInverseView();
      } else {
        // 其他页面后续实现
        if (viewContainer) {
          viewContainer.innerHTML = "";
        }
      }

      console.log("切换到模块：", label);
    });
  });

  // 默认进入“应力传感器”页面
  renderSensorView();
});


