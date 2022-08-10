module.exports = {
    '*.ts': [
        'eslint --ext .ts --fix .',
        'jest --bail --findRelatedTests'
    ],
};