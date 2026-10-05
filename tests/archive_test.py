import importlib.util, io, pathlib, tarfile, tempfile, unittest, zipfile
SPEC=importlib.util.spec_from_file_location('archive',pathlib.Path(__file__).parents[1]/'scripts/safe-extract.py')
module=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)
class ArchiveTests(unittest.TestCase):
    def test_tar_traversal_and_links_rejected_before_writes(self):
        for name, kind in [('../escape',tarfile.REGTYPE),('/absolute',tarfile.REGTYPE),('link',tarfile.SYMTYPE),('pipe',tarfile.FIFOTYPE)]:
            with tempfile.TemporaryDirectory() as root:
                archive=pathlib.Path(root)/'bad.tgz'
                with tarfile.open(archive,'w:gz') as tar:
                    item=tarfile.TarInfo(name);item.type=kind;tar.addfile(item)
                with self.assertRaises(ValueError): module.extract_tar(archive,pathlib.Path(root)/'out')
                self.assertFalse((pathlib.Path(root)/'out').exists())
    def test_valid_tar_and_duplicate_rejection(self):
        with tempfile.TemporaryDirectory() as root:
            archive=pathlib.Path(root)/'good.tgz'
            with tarfile.open(archive,'w:gz') as tar:
                item=tarfile.TarInfo('./release.json');item.size=2;tar.addfile(item,io.BytesIO(b'{}'))
            module.extract_tar(archive,pathlib.Path(root)/'out')
            self.assertEqual((pathlib.Path(root)/'out/release.json').read_text(),'{}')
    def test_wrapper_must_have_exact_expected_members(self):
        with tempfile.TemporaryDirectory() as root:
            archive=pathlib.Path(root)/'bad.zip'
            with zipfile.ZipFile(archive,'w') as z: z.writestr('../escape','x')
            with self.assertRaises(ValueError): module.extract_zip(archive,pathlib.Path(root)/'out')
if __name__=='__main__': unittest.main()
