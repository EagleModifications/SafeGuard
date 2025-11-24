module.exports = function parseDuration(str) {
    if (!str) return null;

    const regex = /^(\d+)(s|m|h|d|w)$/i;
    const match = str.match(regex);
    if (!match) return null;

    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
        s: 1000,
        m: 60000,
        h: 3600000,
        d: 86400000,
        w: 604800000
    };

    return num * multipliers[unit];
};