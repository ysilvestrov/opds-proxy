"""Reject links/devices/traversal/duplicates and bound expanded artifact size."""
import os, pathlib, shutil, sys, tarfile, zipfile
MAX=512*1024*1024
def safe_name(name):
    if '\\' in name or '\x00' in name or name.startswith('/') or '..' in name.split('/') or ':' in name: raise ValueError('Unsafe archive path')
    return pathlib.PurePosixPath(name).as_posix()
def extract_tar(archive,destination):
    with tarfile.open(archive,'r:gz') as tar:
        members=tar.getmembers()
        if len(members)>50000: raise ValueError('Too many archive members')
        names=set();size=0
        for m in members:
            name=safe_name(m.name)
            if name in names or not (m.isfile() or m.isdir()) or m.size<0: raise ValueError('Unsafe archive member')
            names.add(name);size+=m.size
            if size>MAX or m.size>128*1024*1024: raise ValueError('Archive expanded size limit')
        # Reject a file used as another entry's parent before extracting anything.
        files={safe_name(m.name) for m in members if m.isfile()}
        for name in names:
            if any(p.as_posix() in files for p in pathlib.PurePosixPath(name).parents): raise ValueError('File parent conflict')
        destination=pathlib.Path(destination)
        if destination.exists(): raise ValueError('Destination must be fresh')
        destination.mkdir(mode=0o755)
        tar.extractall(destination,members=members,filter='data')
        for path in destination.rglob('*'): path.chmod(0o755 if path.is_dir() else 0o644)
def extract_zip(archive,destination):
    with zipfile.ZipFile(archive) as z:
        members=z.infolist()
        if len(members)!=2 or {m.filename for m in members}!={'release.tgz','release.tgz.sha256'}: raise ValueError('Unexpected artifact wrapper')
        if sum(m.file_size for m in members)>256*1024*1024: raise ValueError('Artifact too large')
        destination=pathlib.Path(destination);destination.mkdir(mode=0o755)
        for m in members:
            if m.is_dir() or (m.external_attr>>16)&0o170000==0o120000: raise ValueError('Artifact link')
            with z.open(m) as source, open(destination/m.filename,'xb') as target: shutil.copyfileobj(source,target,1024*1024)
if __name__=='__main__':
    kind,archive,destination=sys.argv[1:]
    {'tar':extract_tar,'zip':extract_zip}[kind](archive,destination)
