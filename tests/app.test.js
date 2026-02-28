jest.mock('firebase-admin', () => {
    return {
        credential: {
            cert: jest.fn()
        },
        initializeApp: jest.fn(),
        firestore: jest.fn(() => ({
            collection: jest.fn(() => ({
                orderBy: jest.fn(() => ({
                    limit: jest.fn(() => ({
                        get: jest.fn(() => Promise.resolve({ docs: [] }))
                    }))
                }))
            }))
        }))
    };
});

// Mock the potentially missing service account key for CI environments
jest.mock('../firebase-key.json', () => ({}), { virtual: true });

const request = require('supertest');
const app = require('../server');

describe('App Endpoints', () => {
    describe('GET /', () => {
        it('should respond with a 200 OK', async () => {
            const response = await request(app).get('/');
            expect(response.statusCode).toBe(200);
        });
    });

    describe('GET /auth/login', () => {
        it('should respond with a 200 OK for the login page', async () => {
            const response = await request(app).get('/auth/login');
            expect(response.statusCode).toBe(200);
        });
    });
});
