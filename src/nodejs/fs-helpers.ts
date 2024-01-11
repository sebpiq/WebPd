import fs from 'fs'

const pathStatsSync = (filepath: string) => {
    try {
        return fs.statSync(filepath)
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            return null
        }
        throw err
    }
}

export const isDirectorySync = (filepath: string) => {
    let fileStats: fs.Stats | null = pathStatsSync(filepath)
    if (!fileStats) {
        return false
    } else {
        return fileStats.isDirectory()
    }
}

export const isFileSync = (filepath: string) => {
    let fileStats: fs.Stats | null = pathStatsSync(filepath)
    if (!fileStats) {
        return false
    } else {
        return fileStats.isFile()
    }
}