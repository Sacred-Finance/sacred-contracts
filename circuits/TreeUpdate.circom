include "./MerkleTreeUpdater.circom";

// zeroLeaf = keccak256("sacred") % FIELD_SIZE
component main = MerkleTreeUpdater(20, 18057714445064126197463363025270544038935021370379666668119966501302555028628);
