class SubtitleMerger {
    constructor() {
      this.files = [];
      this.result = {};
      this.initializeEventListeners();
    }
  
    initializeEventListeners() {
      $('#srt_file').on('change', () => this.refreshAddFileButtonDisabled());
      $('#add_files_block form').on('submit', (e) => {
        e.preventDefault();
        this.addFile();
        e.target.reset();
        this.refreshAddFileButtonDisabled();
        this.hideDownloadSuccessAlert();
      });
      $('#download_result_file_form').on('submit', (e) => {
        e.preventDefault();
        if (this.shouldGroupFiles()) {
          this.downloadGroupedFiles();
        } else {
          this.downloadSingleFile();
        }
        this.showDownloadSuccessAlert();
      });
      $('#clear_files_button').on('click', () => {
        this.clearFiles();
        this.hideDownloadSuccessAlert();
      });
    }
  
    refreshAddFileButtonDisabled() {
      const fileInput = document.getElementById('srt_file');
      $('#add_file_button').prop("disabled", fileInput.files.length === 0);
    }
  
    showDownloadSuccessAlert() {
      const alert = $('#download_success_alert');
      alert.removeClass('fade').show();
    }
  
    hideDownloadSuccessAlert() {
      const alert = $('#download_success_alert');
      alert.addClass('fade');
      setTimeout(() => alert.hide(), 150);
    }
  
    clearFiles() {
      this.files = [];
      this.result = {};
      $('#files_list_block tbody tr.uploaded_file').remove();
      $('#empty_file_in_list').show();
      $('#result_filename').val('');
      $('#clear_files_button').prop('disabled', true);
      this.checkDownloadButtonDisabled();
      this.updateFilenameInputVisibility();
    }
  
    addFileToTable(fileInfo) {
      $('#empty_file_in_list').hide();
      $('#clear_files_button').prop('disabled', false);
  
      const fname = fileInfo.file.name;
      const colorName = fileInfo.colorName;
      const sample = fileInfo.data[Math.floor(Math.random() * fileInfo.data.length)].content;
      const row = `<tr class='uploaded_file'><td>${fname}</td><td>${colorName}</td><td>${sample.replace("\n", "<br />")}</td></tr>`;
      $('#files_list_block tbody').append(row);
    }
  
    checkDownloadButtonDisabled() {
      $('#result_file_block button[type=submit]').prop("disabled", this.files.length < 2);
    }
  
    parseTime(s) {
      const times = s.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      return (parseInt(times[1]) * 3600) + (parseInt(times[2]) * 60) + (parseInt(times[3])) + (parseInt(times[4]) * 0.001);
    }
  
    parseTimes(s) {
      const strings = s.split(" --> ");
      return [this.parseTime(strings[0]), this.parseTime(strings[1])];
    }
  
    parseSrtFile(data, fileindex) {
      const lines = data.split('\n');
      let state = 1;
      const srt_lines = [];
      let time_from = null;
      let time_to = null;
      let content = [];
  
      for (let i = 0; i < lines.length; i++) {
        const s = lines[i];
  
        switch (state) {
          case 1: // Start, looking for first subtitle
            if (s === "") break;
            if (/^\d+$/.test(s)) {
              state = 2;
              break;
            }
            break;
  
          case 2: // Want timestamps
            content = [];
            time_from = null;
            time_to = null;
  
            if (/^\d{2}:\d{2}:\d{2},\d{3} --> \d\d:\d\d:\d\d,\d{3}/.test(s)) {
              const times = this.parseTimes(s);
              time_from = times[0];
              time_to = times[1];
              state = 3;
              break;
            }
            break;
  
          case 3: // Reading subtitle, first line of text
            if (s === "") {
              state = 5;
              break;
            }
            state = 4;
            content.push(s);
            break;
  
          case 4: // Reading subtitle, following line of text
            if (s === "") {
              state = 5;
              break;
            }
            state = 4;
            content.push(s);
            break;
  
          case 5: // Reading subtitle, on blank line
            if (s === "") {
              state = 5;
              content.push(s);
              break;
            }
            if (/^\d+$/.test(s)) {
              state = 2;
              srt_lines.push({ from: time_from, to: time_to, content: content.join("\n"), fileindex });
              break;
            }
            state = 4;
            content.push(s);
            break;
        }
      }
  
      srt_lines.push({ from: time_from, to: time_to, content: content.join("\n"), fileindex });
      return srt_lines;
    }
  
    updateFilenameInputVisibility() {
      const shouldGroup = this.shouldGroupFiles();
      const filenameInput = $('#result_filename').closest('.col-md-10');
      const downloadButton = $('#download_result_file_form button[type=submit]').closest('.col-md-2');
      
      if (shouldGroup) {
        filenameInput.hide();
        downloadButton.removeClass('col-md-2').addClass('col-md-12');
      } else {
        filenameInput.show();
        downloadButton.removeClass('col-md-12').addClass('col-md-2');
      }
    }
  
    addFile() {
      const form = $('#add_files_block');
      const colorSelect = form.find('#color_select option:selected');
      
      Array.from(document.getElementById('srt_file').files).forEach(file => {
        const reader = new FileReader();
        const fileInfo = { file, color: colorSelect.val(), colorName: colorSelect.text() };
        
        reader.onload = (progressEvent) => {
          const fileindex = $('#files_list_block tbody tr.uploaded_file').length;
          fileInfo.data = this.parseSrtFile(progressEvent.target.result, fileindex);
          
          this.files.push(fileInfo);
          this.addFileToTable(fileInfo);
          this.suggestOutputFileName(file);
          this.checkDownloadButtonDisabled();
          this.updateFilenameInputVisibility();
        };
        reader.readAsText(file);
      });
    }
  
    suggestOutputFileName(file) {
      const fname = $('#result_filename');
      if (fname.val() === "") {
        fname.val(this.getBaseFileName(file.name) + '.merged.srt');
      }
    }
  
    srtTimeString(t) {
      const ms = sprintf("%.3f", t % 1).replace('0.', '');
      return sprintf("%02d:%02d:%02d,%s", t / 3600, (t % 3600) / 60, t % 60, ms);
    }
  
    recordToText(num, record) {
      const times = [this.srtTimeString(record.from), this.srtTimeString(record.to)].join(" --> ");
      return [num, times, record.content].join("\n");
    }
  
    getPartsForPoint(all_parts, point) {
      return all_parts
        .filter(p => p.from <= point && p.to > point)
        .map(p => JSON.parse(JSON.stringify(p)));
    }
  
    getMergedFileData(filesToMerge = this.files) {
      const data = [];
      const points = new Set();
  
      // Create a map of original file indices to new indices in the subset
      const fileIndexMap = new Map();
      filesToMerge.forEach((file, newIndex) => {
        const originalIndex = this.files.indexOf(file);
        fileIndexMap.set(originalIndex, newIndex);
      });
  
      filesToMerge.forEach(file => {
        file.data.forEach(record => {
          // Create a copy of the record with adjusted fileindex
          const adjustedRecord = {
            ...record,
            fileindex: fileIndexMap.get(record.fileindex)
          };
          data.push(adjustedRecord);
          points.add(record.from);
          points.add(record.to);
        });
      });
  
      const sortedPoints = Array.from(points).sort((a, b) => a - b);
      const new_parts = [];
  
      sortedPoints.forEach(point => {
        const parts = this.getPartsForPoint(data, point);
        if (parts.length === 0) return;
  
        const last_part = new_parts.length > 0 ? new_parts[new_parts.length - 1] : null;
  
        if (last_part) {
          last_part.to = Math.min(last_part.to, point);
        }
  
        if (parts.length === 1) {
          new_parts.push({
            from: point,
            to: parts[0].to,
            content: this.coloredText(parts[0], filesToMerge)
          });
          return;
        }
  
        const to = Math.min(...parts.map(p => p.to));
        const sortedParts = parts.sort((a, b) => a.fileindex - b.fileindex);
        const contents = sortedParts.map(t => this.coloredText(t, filesToMerge));
  
        new_parts.push({
          from: point,
          to,
          content: contents.join("\n")
        });
      });
  
      this.result = new_parts;
      return new_parts
        .map((item, index) => this.recordToText(index + 1, item))
        .join("\n\n");
    }
  
    coloredText(rec, filesToMerge = this.files) {
      const color = filesToMerge[rec.fileindex].color;
      return color === "" ? rec.content : `<font color='${color}'>${rec.content}</font>`;
    }
  
    getBaseFileName(filename) {
      // Remove the .srt extension
      const withoutExt = filename.replace(/\.srt$/, '');
      // Remove language codes (e.g., .eng, .zh) and any trailing dots
      return withoutExt.replace(/\.[a-z]{2,3}(\.[a-z]{2,3})?$/, '');
    }
  
    groupFilesByBaseName() {
      const groups = new Map();
      
      this.files.forEach(fileInfo => {
        const baseName = this.getBaseFileName(fileInfo.file.name);
        if (!groups.has(baseName)) {
          groups.set(baseName, []);
        }
        groups.get(baseName).push(fileInfo);
      });
  
      return groups;
    }
  
    shouldGroupFiles() {
      if (this.files.length <= 2) return false;
      
      const groups = this.groupFilesByBaseName();
      return Array.from(groups.values()).length > 1;
    }
  
    downloadFileFromMemory(filename, text) {
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
      element.setAttribute('download', filename);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  
    downloadGroupedFiles() {
      const groups = this.groupFilesByBaseName();
      const groupEntries = Array.from(groups.entries());
      
      // Process each group with a delay
      groupEntries.forEach(([baseName, groupFiles], index) => {
        if (groupFiles.length >= 2) {
          setTimeout(() => {
            // Generate merged content for this group
            const data = this.getMergedFileData(groupFiles);
            
            // Create filename for this group using the base filename
            const groupOutputName = `${baseName}.merged.srt`;
            
            // Download the file
            this.downloadFileFromMemory(groupOutputName, data);
          }, index * 100); // 100ms delay between each download
        }
      });
    }
  
    downloadSingleFile() {
      const data = this.getMergedFileData(this.files);
      const fname = $('#result_filename').val();
      this.downloadFileFromMemory(fname, data);
    }
  }
  
  $(function() {
    window.subtitleMerger = new SubtitleMerger();
  }); 
  