export default {
	supported: 'showOpenFilePicker' in window && 'showSaveFilePicker' in window,
	fileHandle: null,
	content: () => null,
	requireSupport() {
		if (!this.supported) {
			alert('This feature is not supported in your browser. Please use a modern chromium based browser like Chrome or Edge.');
			return false;
		}
		return true;
	},
	async saveFile() {
		if (!this.requireSupport()) return;
		if (!this.fileHandle){
			await this.saveAs();
			return;
		}
		const writable = await this.fileHandle.createWritable();
		if (this.content() === null)
			console.error('No content to save.');
		await writable.write(this.content());
		await writable.close();
	},
	async saveAs() {
		if (!this.requireSupport()) return;
		try {
			this.fileHandle = await window.showSaveFilePicker({
				types: [{
					description: 'JSON file',
					accept: {'application/json': ['.json']},
				}],
			});
		} catch (err) {
			if (err.name === 'AbortError') {
				console.log(err);
				return;
			}
		}
		this.saveFile();
	},
	async openFile() {
		if (!this.requireSupport()) return;
		try {
			[this.fileHandle] = await window.showOpenFilePicker();
		}
		catch (err) {
			if (err.name === 'AbortError') {
				console.log(err);
				return;
			}
		}
		return (await this.fileHandle.getFile()).text();
	}
}