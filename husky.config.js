module.exports = {
    hooks: {
        'pre-commit': 'tsc && tsc --build --clean && lint-staged'
    },
};