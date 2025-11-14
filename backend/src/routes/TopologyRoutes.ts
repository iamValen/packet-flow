import express from 'express';
import { getAllTopologies, getTopologyById, createTopology, updateTopology, deleteTopology, duplicateTopology } from '../controllers/TopologyController.js';

const router = express.Router();

/**
 * @route   GET /api/topologies
 * @desc    Get all topologies
 * @access  Public
 */
router.get('/', getAllTopologies);

/**
 * @route   GET /api/topologies/:id
 * @desc    Get single topology by ID
 * @access  Public
 */
router.get('/:id', getTopologyById);

/**
 * @route   POST /api/topologies
 * @desc    Create new topology
 * @access  Public
 */
router.post('/', createTopology);

/**
 * @route   PUT /api/topologies/:id
 * @desc    Update topology
 * @access  Public
 */
router.put('/:id', updateTopology);

/**
 * @route   DELETE /api/topologies/:id
 * @desc    Delete topology
 * @access  Public
 */
router.delete('/:id', deleteTopology);

/**
 * @route   POST /api/topologies/:id/duplicate
 * @desc    Duplicate existing topology
 * @access  Public
 */
router.post('/:id/duplicate', duplicateTopology);

export default router;